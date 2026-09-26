import { Injectable } from '@nestjs/common';

import {
  AiProvidersRepository,
  type ProviderWithModels,
} from '../repositories/ai-providers.repository';
import { AiProviderRegistry } from './ai-provider-registry.service';

/** Read-only provider queries for end users and other modules (dashboards, system health). */
@Injectable()
export class AiProvidersService {
  constructor(
    private readonly repository: AiProvidersRepository,
    private readonly registry: AiProviderRegistry,
  ) {}

  async listSelectable(): Promise<ProviderWithModels[]> {
    const providers = await this.repository.listEnabled();
    return providers.filter((provider) => this.registry.isTypeAvailable(provider.type));
  }

  listAll(): Promise<ProviderWithModels[]> {
    return this.repository.listAll();
  }
}
