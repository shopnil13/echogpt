import { Module } from '@nestjs/common';

import { CryptoModule } from '../../infrastructure/crypto/crypto.module';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { MockAdapter } from './adapters/mock.adapter';
import { OpenAiAdapter } from './adapters/openai.adapter';
import { AdminProvidersController } from './controllers/admin-providers.controller';
import { ProvidersController } from './controllers/providers.controller';
import {
  AI_PROVIDER_ADAPTERS,
  type AiProviderAdapter,
} from './interfaces/ai-provider-adapter.interface';
import { AiProvidersRepository } from './repositories/ai-providers.repository';
import { AiProviderRegistry } from './services/ai-provider-registry.service';
import { AiProviderResolver } from './services/ai-provider-resolver.service';
import { AiProvidersAdminService } from './services/ai-providers-admin.service';
import { AiProvidersService } from './services/ai-providers.service';

const ADAPTERS = [OpenAiAdapter, AnthropicAdapter, GeminiAdapter, MockAdapter];

@Module({
  imports: [CryptoModule],
  controllers: [ProvidersController, AdminProvidersController],
  providers: [
    ...ADAPTERS,
    {
      // Adding a provider = one enum value, one adapter class, one entry here (ADR-010).
      provide: AI_PROVIDER_ADAPTERS,
      inject: ADAPTERS,
      useFactory: (...adapters: AiProviderAdapter[]) => adapters,
    },
    AiProvidersRepository,
    AiProviderRegistry,
    AiProviderResolver,
    AiProvidersAdminService,
    AiProvidersService,
  ],
  exports: [AiProviderResolver, AiProvidersService, AiProvidersAdminService],
})
export class AiProvidersModule {}
