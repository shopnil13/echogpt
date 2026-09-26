import { HttpStatus } from '@nestjs/common';

import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import {
  type SearchOptions,
  type SearchResultItem,
  type WebSearchEngine,
} from '../interfaces/web-search-engine.interface';

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
const MAX_TITLE_LENGTH = 300;
const MAX_SNIPPET_LENGTH = 2000;

interface TavilyResult {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  score?: unknown;
  published_date?: unknown;
}

/** Tavily search API (designed for LLM consumption). The endpoint is fixed in code, never user-supplied. */
export class TavilySearchEngine implements WebSearchEngine {
  readonly name = 'tavily';

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number,
  ) {}

  async search(
    query: string,
    options: SearchOptions,
    signal?: AbortSignal,
  ): Promise<SearchResultItem[]> {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(TAVILY_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          query,
          max_results: options.maxResults,
          search_depth: 'basic',
          include_answer: false,
        }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (error: unknown) {
      throw unavailable(
        timeout.aborted ? 'Search engine timed out' : 'Search engine is unreachable',
        error,
      );
    }

    if (!response.ok) throw unavailable(`Search engine responded with HTTP ${response.status}`);
    const payload = (await response.json().catch(() => null)) as { results?: unknown } | null;
    if (!payload || !Array.isArray(payload.results))
      throw unavailable('Search engine returned an invalid payload');
    return (payload.results as TavilyResult[]).flatMap(toResultItem).slice(0, options.maxResults);
  }
}

/** Narrows an untrusted result; drops entries without a usable http(s) URL. */
function toResultItem(raw: TavilyResult): SearchResultItem[] {
  if (typeof raw.url !== 'string' || !/^https?:\/\//i.test(raw.url)) return [];
  return [
    {
      title: typeof raw.title === 'string' ? raw.title.slice(0, MAX_TITLE_LENGTH) : raw.url,
      url: raw.url,
      snippet: typeof raw.content === 'string' ? raw.content.slice(0, MAX_SNIPPET_LENGTH) : '',
      score: typeof raw.score === 'number' ? raw.score : null,
      publishedAt: typeof raw.published_date === 'string' ? raw.published_date : null,
    },
  ];
}

function unavailable(reason: string, cause?: unknown): AppException {
  return new AppException(
    HttpStatus.BAD_GATEWAY,
    ErrorCode.SEARCH_ENGINE_UNAVAILABLE,
    'Web search is temporarily unavailable',
    {
      details: null,
      cause: cause ?? reason,
    },
  );
}
