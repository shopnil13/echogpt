import { Inject, Injectable } from '@nestjs/common';

import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { aiConfig, type AiConfig } from '../../../config/ai.config';
import {
  type AiProviderAdapter,
  type ProviderRuntimeConfig,
} from '../interfaces/ai-provider-adapter.interface';
import {
  AiProvidersRepository,
  type ProviderWithModels,
} from '../repositories/ai-providers.repository';
import { AiProviderRegistry } from './ai-provider-registry.service';

export interface ProviderSelection {
  /** Explicit choice from the request. */
  providerId?: string | null;
  model?: string | null;
  /** Remembered choice (e.g. the conversation's preferred provider), used when the request has none. */
  preferredProviderId?: string | null;
  preferredModel?: string | null;
}

export interface ResolvedProvider {
  providerId: string;
  providerName: string;
  model: string;
  maxOutputTokens: number;
  adapter: AiProviderAdapter;
  config: ProviderRuntimeConfig;
}

/**
 * Chooses the provider and model for an AI call: request > preferred > default provider,
 * and request > preferred (same provider only) > provider default model. Only enabled
 * providers and models can be selected.
 */
@Injectable()
export class AiProviderResolver {
  constructor(
    private readonly repository: AiProvidersRepository,
    private readonly registry: AiProviderRegistry,
    @Inject(aiConfig.KEY) private readonly config: AiConfig,
  ) {}

  async resolve(selection: ProviderSelection = {}): Promise<ResolvedProvider> {
    const provider = await this.selectProvider(selection);
    const model = this.selectModel(provider, selection);
    return {
      providerId: provider.id,
      providerName: provider.name,
      model,
      maxOutputTokens: this.config.maxOutputTokens,
      adapter: this.registry.adapterFor(provider.type),
      config: this.registry.runtimeConfig(provider),
    };
  }

  private async selectProvider(selection: ProviderSelection): Promise<ProviderWithModels> {
    const requestedId = selection.providerId ?? selection.preferredProviderId;
    const provider = requestedId
      ? await this.repository.findById(requestedId)
      : await this.repository.findDefault();

    if (!provider) {
      if (!requestedId) {
        throw new AppException(503, ErrorCode.NO_DEFAULT_PROVIDER, 'No AI provider is configured');
      }
      throw AppException.notFound(ErrorCode.PROVIDER_NOT_FOUND, 'AI provider not found');
    }
    if (!provider.isEnabled || !this.registry.isTypeAvailable(provider.type)) {
      throw AppException.unprocessable(
        ErrorCode.PROVIDER_DISABLED,
        `${provider.name} is currently disabled`,
      );
    }
    return provider;
  }

  private selectModel(provider: ProviderWithModels, selection: ProviderSelection): string {
    const preferredApplies =
      !selection.providerId || selection.providerId === selection.preferredProviderId;
    const model =
      selection.model ??
      (preferredApplies ? selection.preferredModel : null) ??
      provider.defaultModel;

    const allowed = provider.models.some(
      (candidate) => candidate.name === model && candidate.isEnabled,
    );
    if (!allowed) {
      throw AppException.unprocessable(
        ErrorCode.PROVIDER_MODEL_NOT_ALLOWED,
        `Model "${model}" is not available for ${provider.name}`,
      );
    }
    return model;
  }
}
