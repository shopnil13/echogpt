import { createHash } from 'node:crypto';

import {
  type SearchOptions,
  type SearchResultItem,
  type WebSearchEngine,
} from '../interfaces/web-search-engine.interface';

/** Deterministic, keyless results for development and tests. */
export class MockSearchEngine implements WebSearchEngine {
  readonly name = 'mock';

  search(query: string, options: SearchOptions): Promise<SearchResultItem[]> {
    const slug = createHash('sha256').update(query).digest('hex').slice(0, 8);
    const results = Array.from({ length: options.maxResults }, (_unused, index) => ({
      title: `Result ${index + 1} for "${query}"`,
      url: `https://example.com/search/${slug}/${index + 1}`,
      snippet: `Mock snippet ${index + 1} about ${query}.`,
      score: Number((1 - index / (options.maxResults + 1)).toFixed(3)),
      publishedAt: null,
    }));
    return Promise.resolve(results);
  }
}
