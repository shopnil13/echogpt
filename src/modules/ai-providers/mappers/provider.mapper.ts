import { type AdminProviderResponseDto } from '../dto/responses/admin-provider.response.dto';
import { type ProviderResponseDto } from '../dto/responses/provider.response.dto';
import { type ProviderWithModels } from '../repositories/ai-providers.repository';

/** Explicit allowlist: `apiKeyEncrypted` is never mapped. */
export function toAdminProviderResponse(provider: ProviderWithModels): AdminProviderResponseDto {
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    baseUrl: provider.baseUrl,
    hasApiKey: provider.apiKeyEncrypted !== null,
    apiKeyLast4: provider.apiKeyLast4,
    defaultModel: provider.defaultModel,
    isEnabled: provider.isEnabled,
    isDefault: provider.isDefault,
    timeoutMs: provider.timeoutMs,
    health: {
      status: provider.healthStatus,
      checkedAt: provider.lastHealthCheckAt,
      latencyMs: provider.lastHealthLatencyMs,
      error: provider.lastHealthError,
    },
    models: provider.models.map((model) => ({
      id: model.id,
      name: model.name,
      displayName: model.displayName,
      isEnabled: model.isEnabled,
    })),
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

export function toProviderResponse(provider: ProviderWithModels): ProviderResponseDto {
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    isDefault: provider.isDefault,
    defaultModel: provider.defaultModel,
    models: provider.models
      .filter((model) => model.isEnabled)
      .map((model) => ({ name: model.name, displayName: model.displayName })),
  };
}
