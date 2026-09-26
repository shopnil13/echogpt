import { Inject, Injectable } from '@nestjs/common';

import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { aiConfig, type AiConfig } from '../../../config/ai.config';
import { ProviderType } from '../../../generated/prisma/enums';
import { EncryptionService } from '../../../infrastructure/crypto/encryption.service';
import {
  AI_PROVIDER_ADAPTERS,
  type AiProviderAdapter,
  type ProviderRuntimeConfig,
} from '../interfaces/ai-provider-adapter.interface';
import { type ProviderWithModels } from '../repositories/ai-providers.repository';

/** Maps provider types to adapters and builds per-call runtime configuration (decrypted in memory only). */
@Injectable()
export class AiProviderRegistry {
  private readonly adapters: Map<ProviderType, AiProviderAdapter>;

  constructor(
    @Inject(AI_PROVIDER_ADAPTERS) adapters: AiProviderAdapter[],
    private readonly encryption: EncryptionService,
    @Inject(aiConfig.KEY) private readonly config: AiConfig,
  ) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.type, adapter]));
  }

  /** The MOCK type exists only when explicitly enabled (development, tests, reviews). */
  isTypeAvailable(type: ProviderType): boolean {
    return type !== ProviderType.MOCK || this.config.mockProviderEnabled;
  }

  adapterFor(type: ProviderType): AiProviderAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter || !this.isTypeAvailable(type)) {
      throw AppException.unprocessable(
        ErrorCode.PROVIDER_TYPE_UNAVAILABLE,
        `Provider type ${type} is not available`,
      );
    }
    return adapter;
  }

  runtimeConfig(provider: ProviderWithModels, timeoutMs?: number): ProviderRuntimeConfig {
    return {
      apiKey: provider.apiKeyEncrypted ? this.encryption.decrypt(provider.apiKeyEncrypted) : null,
      baseUrl: provider.baseUrl,
      timeoutMs: timeoutMs ?? provider.timeoutMs ?? this.config.requestTimeoutMs,
    };
  }
}
