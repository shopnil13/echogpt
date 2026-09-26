import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { RequestContext } from '../../../common/context/request-context';
import { type AuthenticatedUser } from '../../../common/types/authenticated-user';
import { UsageLogsService } from '../services/usage-logs.service';

const MAX_USER_AGENT_LENGTH = 512;
const UNMATCHED_ROUTE = '(unmatched)';
/** Probes and docs would drown the table in noise. */
const EXCLUDED_PATH_PREFIXES = ['/api/v1/health', '/api/docs'];

/**
 * Writes one `api_usage_logs` row per request once the response is finished, so the final
 * status code (including errors mapped by the exception filter and streamed responses) is known.
 */
@Injectable()
export class UsageLogMiddleware implements NestMiddleware {
  constructor(private readonly usageLogsService: UsageLogsService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    if (EXCLUDED_PATH_PREFIXES.some((prefix) => request.originalUrl.startsWith(prefix))) {
      next();
      return;
    }

    const startedAt = process.hrtime.bigint();
    const context = RequestContext.current();

    response.on('finish', () => {
      const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
      const user = (request as Request & { user?: AuthenticatedUser }).user;
      const usage = context?.usage ?? {};
      const userAgent = request.headers['user-agent'];

      this.usageLogsService.record({
        requestId: context?.requestId ?? (typeof request.id === 'string' ? request.id : ''),
        userId: user?.id ?? null,
        method: request.method,
        route: resolveRoutePattern(request),
        statusCode: response.statusCode,
        durationMs,
        ipAddress: request.ip ?? null,
        userAgent: userAgent ? userAgent.slice(0, MAX_USER_AGENT_LENGTH) : null,
        feature: usage.feature ?? null,
        providerId: usage.providerId ?? null,
        model: usage.model ?? null,
        promptTokens: usage.promptTokens ?? null,
        completionTokens: usage.completionTokens ?? null,
        errorCode: context?.errorCode ?? null,
      });
    });

    next();
  }
}

/** Route pattern (`/api/v1/chat/conversations/:id`) keeps IDs out of the log and groups analytics. */
function resolveRoutePattern(request: Request): string {
  const routePath = (request.route as { path?: unknown } | undefined)?.path;
  if (typeof routePath !== 'string') return UNMATCHED_ROUTE;
  return `${request.baseUrl}${routePath}`;
}
