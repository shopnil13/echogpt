import { Inject, Injectable } from '@nestjs/common';

import { RequestContext } from '../../../common/context/request-context';
import {
  type Paginated,
  paginate,
  type PaginationQueryDto,
} from '../../../common/dto/pagination.dto';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type QuotaReservation } from '../../../common/types/quota-reservation';
import { searchConfig, type SearchConfig } from '../../../config/search.config';
import { type Prisma, type WebSearch } from '../../../generated/prisma/client';
import { UsageFeature } from '../../../generated/prisma/enums';
import { QuotaService } from '../../subscriptions/services/quota.service';
import { DEFAULT_SEARCH_RESULTS, type SearchDto } from '../dto/search.dto';
import {
  type SearchResultItem,
  WEB_SEARCH_ENGINE,
  type WebSearchEngine,
} from '../interfaces/web-search-engine.interface';
import { SearchCacheRepository } from '../repositories/search-cache.repository';
import {
  type RecentQuery,
  type WebSearchSummary,
  WebSearchesRepository,
} from '../repositories/web-searches.repository';
import { normalizeQuery, searchCacheKey } from '../utils/query-normalization';
import { SearchSummaryService } from './search-summary.service';

export interface SearchOutcome {
  entry: WebSearch;
  results: SearchResultItem[];
  summaryError: string | null;
}

export interface Suggestion {
  query: string;
  source: 'history' | 'popular';
}

@Injectable()
export class SearchService {
  constructor(
    @Inject(WEB_SEARCH_ENGINE) private readonly engine: WebSearchEngine,
    private readonly cacheRepository: SearchCacheRepository,
    private readonly searchesRepository: WebSearchesRepository,
    private readonly summaryService: SearchSummaryService,
    private readonly quotaService: QuotaService,
    @Inject(searchConfig.KEY) private readonly config: SearchConfig,
  ) {}

  /** Cache first, then the engine; optional AI summary; always recorded in the user's history. */
  async search(
    userId: string,
    dto: SearchDto,
    reservation: QuotaReservation,
    signal?: AbortSignal,
  ): Promise<SearchOutcome> {
    const startedAt = Date.now();
    const normalizedQuery = normalizeQuery(dto.query);
    const maxResults = dto.maxResults ?? DEFAULT_SEARCH_RESULTS;
    RequestContext.recordUsage({ feature: UsageFeature.SEARCH });

    let lookup: { results: SearchResultItem[]; fromCache: boolean };
    try {
      lookup = await this.lookup(normalizedQuery, maxResults, signal);
    } catch (error: unknown) {
      await this.quotaService.refund(reservation);
      throw error;
    }

    const summary = dto.summarize
      ? await this.summaryService.summarize(dto.query, lookup.results, signal)
      : null;
    if (summary?.providerId) {
      RequestContext.recordUsage({
        providerId: summary.providerId,
        model: summary.model ?? undefined,
        promptTokens: summary.promptTokens ?? undefined,
        completionTokens: summary.completionTokens ?? undefined,
      });
    }

    const entry = await this.searchesRepository.create({
      userId,
      query: dto.query,
      normalizedQuery,
      engine: this.engine.name,
      resultCount: lookup.results.length,
      results: lookup.results as unknown as Prisma.InputJsonValue,
      aiSummary: summary?.text ?? null,
      fromCache: lookup.fromCache,
      latencyMs: Date.now() - startedAt,
    });
    return { entry, results: lookup.results, summaryError: summary?.errorCode ?? null };
  }

  async history(userId: string, query: PaginationQueryDto): Promise<Paginated<WebSearchSummary>> {
    const [items, total] = await this.searchesRepository.list(userId, query.skip, query.limit);
    return paginate(items, total, query);
  }

  async getHistoryEntry(id: string, userId: string): Promise<WebSearch> {
    const entry = await this.searchesRepository.findOwned(id, userId);
    if (!entry) throw this.notFound();
    return entry;
  }

  async deleteHistoryEntry(id: string, userId: string): Promise<void> {
    if (!(await this.searchesRepository.deleteOwned(id, userId))) throw this.notFound();
  }

  async clearHistory(userId: string): Promise<void> {
    await this.searchesRepository.deleteAllForUser(userId);
  }

  recent(userId: string, limit: number): Promise<RecentQuery[]> {
    return this.searchesRepository.recentDistinct(userId, limit);
  }

  /** The user's own history first, then popular queries shared by enough distinct users. */
  async suggestions(userId: string, prefix: string, limit: number): Promise<Suggestion[]> {
    const normalizedPrefix = normalizeQuery(prefix);
    const own = await this.searchesRepository.userPrefixMatches(userId, normalizedPrefix, limit);
    const suggestions: Suggestion[] = own.map((query) => ({ query, source: 'history' }));
    if (suggestions.length >= limit) return suggestions;

    const popular = await this.searchesRepository.popularPrefixMatches(
      normalizedPrefix,
      this.config.suggestionMinUsers,
      limit,
    );
    for (const query of popular) {
      if (suggestions.length >= limit) break;
      if (!own.includes(query)) suggestions.push({ query, source: 'popular' });
    }
    return suggestions;
  }

  private async lookup(
    normalizedQuery: string,
    maxResults: number,
    signal?: AbortSignal,
  ): Promise<{ results: SearchResultItem[]; fromCache: boolean }> {
    const cacheEnabled = this.config.cacheTtlSeconds > 0;
    const cacheKey = searchCacheKey(this.engine.name, normalizedQuery, maxResults);

    if (cacheEnabled) {
      const cached = await this.cacheRepository.takeValid(cacheKey, new Date());
      if (cached) return { results: cached, fromCache: true };
    }

    const results = await this.engine.search(normalizedQuery, { maxResults }, signal);
    if (cacheEnabled) {
      await this.cacheRepository.upsert({
        cacheKey,
        engine: this.engine.name,
        normalizedQuery,
        results,
        expiresAt: new Date(Date.now() + this.config.cacheTtlSeconds * 1000),
      });
    }
    return { results, fromCache: false };
  }

  private notFound(): AppException {
    return AppException.notFound(
      ErrorCode.SEARCH_ENTRY_NOT_FOUND,
      'Search history entry not found',
    );
  }
}
