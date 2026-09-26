import { Module } from '@nestjs/common';

import { searchConfig, type SearchConfig } from '../../config/search.config';
import { AiProvidersModule } from '../ai-providers/ai-providers.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { SearchController } from './controllers/search.controller';
import { MockSearchEngine } from './engines/mock-search.engine';
import { TavilySearchEngine } from './engines/tavily-search.engine';
import { WEB_SEARCH_ENGINE, type WebSearchEngine } from './interfaces/web-search-engine.interface';
import { SearchCacheRepository } from './repositories/search-cache.repository';
import { WebSearchesRepository } from './repositories/web-searches.repository';
import { SearchSummaryService } from './services/search-summary.service';
import { SearchService } from './services/search.service';

@Module({
  imports: [AiProvidersModule, SubscriptionsModule],
  controllers: [SearchController],
  providers: [
    {
      provide: WEB_SEARCH_ENGINE,
      inject: [searchConfig.KEY],
      useFactory: (config: SearchConfig): WebSearchEngine =>
        config.engine === 'tavily' && config.tavilyApiKey
          ? new TavilySearchEngine(config.tavilyApiKey, config.timeoutMs)
          : new MockSearchEngine(),
    },
    SearchCacheRepository,
    WebSearchesRepository,
    SearchSummaryService,
    SearchService,
  ],
})
export class SearchModule {}
