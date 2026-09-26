import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { ErrorResponseDto } from '../dto/error-response.dto';
import {
  type ErrorMapper,
  internalError,
  mapAppException,
  mapBodyParserError,
  mapHttpException,
  type MappedError,
} from '../errors/error-mapper';
import { resolveRequestId } from '../middleware/request-id.middleware';

/**
 * The only place where error responses are shaped. Every thrown error ends up here and is
 * converted to the standard envelope; unexpected errors are logged with their stack and
 * returned as a generic 500 so internals never leak.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly mappers: ErrorMapper[];

  constructor(extraMappers: ErrorMapper[] = []) {
    this.mappers = [mapAppException, ...extraMappers, mapHttpException, mapBodyParserError];
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const mapped = this.map(exception);
    const requestId = resolveRequestId(request, response);

    this.log(exception, mapped, request, requestId);

    // Streaming responses (SSE) have already sent headers; the stream handler reports errors itself.
    if (response.headersSent) {
      response.end();
      return;
    }

    const body: ErrorResponseDto = {
      statusCode: mapped.status,
      code: mapped.code,
      message: mapped.message,
      details: mapped.details,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      requestId,
    };
    response.status(mapped.status).set(mapped.headers).json(body);
  }

  private map(exception: unknown): MappedError {
    for (const mapper of this.mappers) {
      const mapped = mapper(exception);
      if (mapped) return mapped;
    }
    return internalError();
  }

  private log(exception: unknown, mapped: MappedError, request: Request, requestId: string): void {
    const context = {
      requestId,
      method: request.method,
      path: request.originalUrl,
      code: mapped.code,
    };
    if (mapped.status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error({ ...context, err: exception }, 'Request failed with server error');
    } else {
      this.logger.debug({ ...context, status: mapped.status }, 'Request failed with client error');
    }
  }
}
