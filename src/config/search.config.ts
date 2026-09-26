import { registerAs } from '@nestjs/config';

import { envInt, envOptionalString, envString } from './env.utils';

export type SearchEngineKind = 'mock' | 'tavily';

export const searchConfig = registerAs('search', () => ({
  engine: envString('SEARCH_ENGINE') as SearchEngineKind,
  tavilyApiKey: envOptionalString('TAVILY_API_KEY'),
  cacheTtlSeconds: envInt('SEARCH_CACHE_TTL_SECONDS'),
  timeoutMs: envInt('SEARCH_TIMEOUT_MS'),
  suggestionMinUsers: envInt('SEARCH_SUGGESTION_MIN_USERS'),
}));

export type SearchConfig = ReturnType<typeof searchConfig>;
