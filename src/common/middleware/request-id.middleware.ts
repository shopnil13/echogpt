import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { RequestContext } from '../context/request-context';

export const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

type RequestWithId = IncomingMessage & { id?: unknown };

/**
 * Returns the request's ID, assigning one on first call. A well-formed client-supplied
 * `x-request-id` is reused for end-to-end tracing; anything else is replaced by a UUID.
 */
export function resolveRequestId(req: RequestWithId, res: ServerResponse): string {
  if (typeof req.id === 'string') return req.id;
  const incoming = req.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const requestId = candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
  req.id = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  return requestId;
}

/**
 * Registered first so even body-parser failures carry a request ID. Also opens the
 * per-request async context used for usage logging.
 */
export function requestIdMiddleware(
  req: RequestWithId,
  res: ServerResponse,
  next: () => void,
): void {
  const requestId = resolveRequestId(req, res);
  RequestContext.run({ requestId, usage: {} }, next);
}
