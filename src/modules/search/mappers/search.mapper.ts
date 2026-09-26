import { type WebSearch } from '../../../generated/prisma/client';
import {
  type SearchHistoryDetailDto,
  type SearchHistoryItemDto,
  type SearchResponseDto,
  type SearchResultItemDto,
} from '../dto/responses/search.response.dto';
import { type WebSearchSummary } from '../repositories/web-searches.repository';
import { type SearchOutcome } from '../services/search.service';

export function toSearchResponse(outcome: SearchOutcome): SearchResponseDto {
  return {
    id: outcome.entry.id,
    query: outcome.entry.query,
    engine: outcome.entry.engine,
    results: outcome.results,
    summary: outcome.entry.aiSummary,
    summaryError: outcome.summaryError,
    fromCache: outcome.entry.fromCache,
    latencyMs: outcome.entry.latencyMs,
    createdAt: outcome.entry.createdAt,
  };
}

export function toHistoryItem(entry: WebSearchSummary): SearchHistoryItemDto {
  return {
    id: entry.id,
    query: entry.query,
    engine: entry.engine,
    resultCount: entry.resultCount,
    fromCache: entry.fromCache,
    hasSummary: entry.aiSummary !== null,
    createdAt: entry.createdAt,
  };
}

export function toHistoryDetail(entry: WebSearch): SearchHistoryDetailDto {
  return {
    ...toHistoryItem(entry),
    results: entry.results as unknown as SearchResultItemDto[],
    summary: entry.aiSummary,
  };
}
