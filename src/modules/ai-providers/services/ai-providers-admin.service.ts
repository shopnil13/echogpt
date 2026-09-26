import { Inject, Injectable, Logger } from '@nestjs/common';

import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { aiConfig, type AiConfig } from '../../../config/ai.config';
import { ProviderHealthStatus, ProviderType } from '../../../generated/prisma/enums';
import { EncryptionService } from '../../../infrastructure/crypto/encryption.service';
import { isUniqueViolation } from '../../../infrastructure/prisma/prisma-error.mapper';
import { AiProviderError } from '../adapters/ai-provider.error';
import { type CreateProviderDto } from '../dto/create-provider.dto';
import { type ModelInputDto } from '../dto/model-input.dto';
import { type UpdateProviderDto } from '../dto/update-provider.dto';
import {
  AiProvidersRepository,
  type ModelData,
  type ProviderWithModels,
  type ProviderWriteData,
} from '../repositories/ai-providers.repository';
import { assertSafeBaseUrl } from '../utils/base-url.guard';
import { AiProviderRegistry } from './ai-provider-registry.service';

export interface HealthCheckOutcome {
  status: ProviderHealthStatus;
  latencyMs: number | null;
  checkedAt: Date;
  error: string | null;
}

/** Administrative lifecycle of AI providers: CRUD, key rotation, enable/disable, default, health. */
@Injectable()
export class AiProvidersAdminService {
  private readonly logger = new Logger(AiProvidersAdminService.name);

  constructor(
    private readonly repository: AiProvidersRepository,
    private readonly registry: AiProviderRegistry,
    private readonly encryption: EncryptionService,
    @Inject(aiConfig.KEY) private readonly config: AiConfig,
  ) {}

  list(): Promise<ProviderWithModels[]> {
    return this.repository.listAll();
  }

  async get(id: string): Promise<ProviderWithModels> {
    const provider = await this.repository.findById(id);
    if (!provider)
      throw AppException.notFound(ErrorCode.PROVIDER_NOT_FOUND, 'AI provider not found');
    return provider;
  }

  async create(dto: CreateProviderDto): Promise<ProviderWithModels> {
    this.registry.adapterFor(dto.type); // rejects unavailable types (MOCK when disabled)
    const models = normalizeModels(dto.models);
    assertDefaultModel(dto.defaultModel, models);
    if (dto.isEnabled && dto.type !== ProviderType.MOCK && !dto.apiKey) {
      throw this.apiKeyRequired();
    }

    const data: ProviderWriteData = {
      name: dto.name,
      type: dto.type,
      baseUrl: dto.baseUrl ? await assertSafeBaseUrl(dto.baseUrl) : null,
      defaultModel: dto.defaultModel,
      timeoutMs: dto.timeoutMs ?? null,
      isEnabled: dto.isEnabled ?? false,
      ...this.encryptKey(dto.apiKey),
    };
    const provider = await this.repository.create(data, models).catch((error: unknown) => {
      throw isUniqueViolation(error) ? this.nameTaken(dto.name) : error;
    });
    this.logger.log({ providerId: provider.id, type: provider.type }, 'AI provider created');
    return provider;
  }

  async update(id: string, dto: UpdateProviderDto): Promise<ProviderWithModels> {
    const current = await this.get(id);
    const models = dto.models ? normalizeModels(dto.models) : undefined;
    const effectiveModels = models ?? current.models;
    const defaultModel = dto.defaultModel ?? current.defaultModel;
    assertDefaultModel(defaultModel, effectiveModels);

    const data: Partial<ProviderWriteData> = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.defaultModel !== undefined ? { defaultModel: dto.defaultModel } : {}),
      ...(dto.timeoutMs !== undefined ? { timeoutMs: dto.timeoutMs } : {}),
      ...(dto.baseUrl !== undefined
        ? { baseUrl: dto.baseUrl ? await assertSafeBaseUrl(dto.baseUrl) : null }
        : {}),
      ...(dto.apiKey !== undefined
        ? { ...this.encryptKey(dto.apiKey), healthStatus: ProviderHealthStatus.UNKNOWN }
        : {}),
    };
    const provider = await this.repository.update(id, data, models).catch((error: unknown) => {
      throw isUniqueViolation(error) ? this.nameTaken(dto.name ?? current.name) : error;
    });
    this.logger.log(
      { providerId: id, rotatedKey: dto.apiKey !== undefined },
      'AI provider updated',
    );
    return provider;
  }

  async remove(id: string): Promise<void> {
    const provider = await this.get(id);
    if (provider.isDefault)
      throw this.isDefault('Choose another default provider before deleting this one');
    await this.repository.delete(id);
    this.logger.log({ providerId: id }, 'AI provider deleted');
  }

  async setEnabled(id: string, isEnabled: boolean): Promise<ProviderWithModels> {
    const provider = await this.get(id);
    if (!isEnabled && provider.isDefault) {
      throw this.isDefault('Choose another default provider before disabling this one');
    }
    if (isEnabled) {
      this.registry.adapterFor(provider.type);
      if (provider.type !== ProviderType.MOCK && !provider.apiKeyEncrypted)
        throw this.apiKeyRequired();
    }
    return this.repository.update(id, { isEnabled });
  }

  async makeDefault(id: string): Promise<ProviderWithModels> {
    const provider = await this.get(id);
    if (!provider.isEnabled) {
      throw AppException.unprocessable(
        ErrorCode.PROVIDER_DISABLED,
        'Only an enabled provider can be the default',
      );
    }
    const updated = await this.repository.makeDefault(id);
    this.logger.log({ providerId: id }, 'Default AI provider changed');
    return updated;
  }

  /** Live check with a short timeout; the outcome is stored so dashboards can show it. */
  async checkHealth(id: string): Promise<HealthCheckOutcome> {
    const provider = await this.get(id);
    const checkedAt = new Date();
    const startedAt = Date.now();
    let outcome: HealthCheckOutcome;

    try {
      const adapter = this.registry.adapterFor(provider.type);
      await adapter.healthCheck(
        this.registry.runtimeConfig(provider, this.config.healthCheckTimeoutMs),
        provider.defaultModel,
      );
      outcome = {
        status: ProviderHealthStatus.HEALTHY,
        latencyMs: Date.now() - startedAt,
        checkedAt,
        error: null,
      };
    } catch (error: unknown) {
      const detail = error instanceof AiProviderError ? error.detail : 'Health check failed';
      outcome = {
        status: ProviderHealthStatus.UNHEALTHY,
        latencyMs: null,
        checkedAt,
        error: detail,
      };
      this.logger.warn({ providerId: id, detail }, 'AI provider health check failed');
    }

    await this.repository.recordHealth(id, {
      healthStatus: outcome.status,
      lastHealthCheckAt: checkedAt,
      lastHealthLatencyMs: outcome.latencyMs,
      lastHealthError: outcome.error,
    });
    return outcome;
  }

  private encryptKey(
    apiKey: string | undefined,
  ): Pick<ProviderWriteData, 'apiKeyEncrypted' | 'apiKeyLast4'> {
    if (!apiKey) return { apiKeyEncrypted: null, apiKeyLast4: null };
    return { apiKeyEncrypted: this.encryption.encrypt(apiKey), apiKeyLast4: apiKey.slice(-4) };
  }

  private apiKeyRequired(): AppException {
    return AppException.unprocessable(
      ErrorCode.PROVIDER_API_KEY_REQUIRED,
      'Add an API key before enabling this provider',
    );
  }

  private isDefault(message: string): AppException {
    return AppException.unprocessable(ErrorCode.PROVIDER_IS_DEFAULT, message);
  }

  private nameTaken(name: string): AppException {
    return AppException.conflict(
      ErrorCode.PROVIDER_NAME_TAKEN,
      `A provider named "${name}" already exists`,
    );
  }
}

function normalizeModels(models: ModelInputDto[]): ModelData[] {
  const unique = new Map<string, ModelData>();
  for (const model of models) {
    unique.set(model.name, {
      name: model.name,
      displayName: model.displayName ?? model.name,
      isEnabled: model.isEnabled ?? true,
    });
  }
  return [...unique.values()];
}

function assertDefaultModel(
  defaultModel: string,
  models: Array<{ name: string; isEnabled: boolean }>,
): void {
  if (!models.some((model) => model.name === defaultModel && model.isEnabled)) {
    throw AppException.unprocessable(
      ErrorCode.PROVIDER_MODEL_NOT_ALLOWED,
      'defaultModel must be one of the enabled models',
    );
  }
}
