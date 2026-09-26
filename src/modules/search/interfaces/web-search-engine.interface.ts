export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  score: number | null;
  publishedAt: string | null;
}

export interface SearchOptions {
  maxResults: number;
}

/** Search backend contract (ADR-010, ADR-015). Implementations must treat responses as untrusted. */
export interface WebSearchEngine {
  readonly name: string;
  search(query: string, options: SearchOptions, signal?: AbortSignal): Promise<SearchResultItem[]>;
}

export const WEB_SEARCH_ENGINE = Symbol('WEB_SEARCH_ENGINE');
