import { normalizeQuery, searchCacheKey } from './query-normalization';

describe('query normalization', () => {
  it('trims, collapses whitespace and lower-cases', () => {
    expect(normalizeQuery('  Best   Coffee\tin LISBON ')).toBe('best coffee in lisbon');
  });

  it('produces stable cache keys that change with options', () => {
    const key = searchCacheKey('mock', 'coffee', 5);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(searchCacheKey('mock', 'coffee', 5)).toBe(key);
    expect(searchCacheKey('mock', 'coffee', 10)).not.toBe(key);
    expect(searchCacheKey('tavily', 'coffee', 5)).not.toBe(key);
  });
});
