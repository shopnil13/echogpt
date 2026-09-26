import { AsyncLocalStorage } from 'node:async_hooks';

import { type UsageFeature } from '../../generated/prisma/enums';

/** AI/search metadata a service attaches to the current request for usage logging. */
export interface UsageMetadata {
  feature?: UsageFeature;
  providerId?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface RequestStore {
  requestId: string;
  usage: UsageMetadata;
  errorCode?: string;
}

const storage = new AsyncLocalStorage<RequestStore>();

/**
 * Per-request context propagated through async calls. Lets deep services annotate the
 * request (usage metadata, error code) without threading the HTTP request through every layer.
 */
export const RequestContext = {
  run<T>(store: RequestStore, callback: () => T): T {
    return storage.run(store, callback);
  },

  current(): RequestStore | undefined {
    return storage.getStore();
  },

  recordUsage(metadata: UsageMetadata): void {
    const store = storage.getStore();
    if (store) Object.assign(store.usage, metadata);
  },

  setErrorCode(code: string): void {
    const store = storage.getStore();
    if (store) store.errorCode = code;
  },
};
