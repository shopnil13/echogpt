import { createHash } from 'node:crypto';

/** Trimmed, lower-cased, whitespace-collapsed: the identity used for caching and suggestions. */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function searchCacheKey(
  engine: string,
  normalizedQuery: string,
  maxResults: number,
): string {
  return createHash('sha256').update(`${engine}|${normalizedQuery}|${maxResults}`).digest('hex');
}
