import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

import { ErrorResponseDto } from '../dto/error-response.dto';
import { ErrorCode } from '../errors/error-codes';

const DEFAULTS: Partial<
  Record<HttpStatus, { description: string; code: string; message: string }>
> = {
  [HttpStatus.BAD_REQUEST]: {
    description: 'Validation failed or the request is malformed',
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Request validation failed',
  },
  [HttpStatus.UNAUTHORIZED]: {
    description: 'Missing, invalid or expired access token, or revoked session',
    code: ErrorCode.UNAUTHORIZED,
    message: 'Unauthorized',
  },
  [HttpStatus.FORBIDDEN]: {
    description: 'Authenticated but not allowed to perform this action',
    code: ErrorCode.FORBIDDEN,
    message: 'Forbidden',
  },
  [HttpStatus.NOT_FOUND]: {
    description: 'Resource not found (or not owned by the caller)',
    code: ErrorCode.NOT_FOUND,
    message: 'Resource not found',
  },
  [HttpStatus.CONFLICT]: {
    description: 'Conflicts with the current state of a resource',
    code: ErrorCode.CONFLICT,
    message: 'Resource already exists',
  },
  [HttpStatus.UNPROCESSABLE_ENTITY]: {
    description: 'Request is valid but violates a business rule',
    code: ErrorCode.UNPROCESSABLE_ENTITY,
    message: 'Business rule violated',
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    description: 'Rate limit or plan quota exceeded',
    code: ErrorCode.RATE_LIMITED,
    message: 'Too many requests, please slow down',
  },
  [HttpStatus.BAD_GATEWAY]: {
    description: 'An upstream provider failed',
    code: 'PROVIDER_UNAVAILABLE',
    message: 'The AI provider is unavailable',
  },
  [HttpStatus.SERVICE_UNAVAILABLE]: {
    description: 'Service or dependency temporarily unavailable',
    code: ErrorCode.SERVICE_UNAVAILABLE,
    message: 'Service unavailable',
  },
};

export interface ErrorResponseOverride {
  status: HttpStatus;
  description?: string;
  code?: string;
  message?: string;
}

/**
 * Documents error responses with the standard envelope and a realistic example.
 * Pass a status for the default wording, or an object to document a specific error code.
 *
 * @example @ApiErrorResponses(HttpStatus.UNAUTHORIZED, { status: HttpStatus.NOT_FOUND, code: 'CONVERSATION_NOT_FOUND' })
 */
export function ApiErrorResponses(
  ...entries: Array<HttpStatus | ErrorResponseOverride>
): MethodDecorator & ClassDecorator {
  const decorators = entries.map((entry) => {
    const override: ErrorResponseOverride = typeof entry === 'number' ? { status: entry } : entry;
    const defaults = DEFAULTS[override.status];
    const code = override.code ?? defaults?.code ?? ErrorCode.BAD_REQUEST;
    const message = override.message ?? defaults?.message ?? 'Error';
    return ApiResponse({
      status: override.status,
      description: override.description ?? defaults?.description ?? message,
      type: ErrorResponseDto,
      example: {
        statusCode: override.status,
        code,
        message,
        details: null,
        path: '/api/v1/…',
        timestamp: '2026-09-26T10:00:00.000Z',
        requestId: '4f0c8a2e-1b3d-4c5e-9f6a-7b8c9d0e1f2a',
      },
    });
  });
  return applyDecorators(...decorators);
}
