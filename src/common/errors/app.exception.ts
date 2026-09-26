import { HttpException, HttpStatus } from '@nestjs/common';

import { ErrorCode } from './error-codes';

export interface AppExceptionOptions {
  details?: unknown;
  /** Extra response headers, e.g. `Retry-After` for quota errors. */
  headers?: Record<string, string>;
  cause?: unknown;
}

/**
 * Domain exception carrying a stable error code. Throw this (or a subclass) for every
 * expected failure; the global exception filter turns it into the standard error envelope.
 */
export class AppException extends HttpException {
  readonly code: string;
  readonly details: unknown;
  readonly headers: Record<string, string>;

  constructor(
    status: HttpStatus,
    code: string,
    message: string,
    options: AppExceptionOptions = {},
  ) {
    super(message, status, { cause: options.cause });
    this.code = code;
    this.details = options.details ?? null;
    this.headers = options.headers ?? {};
  }

  static badRequest(code: string, message: string, details?: unknown): AppException {
    return new AppException(HttpStatus.BAD_REQUEST, code, message, { details });
  }

  static unauthorized(
    code: string = ErrorCode.UNAUTHORIZED,
    message = 'Unauthorized',
  ): AppException {
    return new AppException(HttpStatus.UNAUTHORIZED, code, message);
  }

  static forbidden(code: string = ErrorCode.FORBIDDEN, message = 'Forbidden'): AppException {
    return new AppException(HttpStatus.FORBIDDEN, code, message);
  }

  static notFound(code: string, message: string): AppException {
    return new AppException(HttpStatus.NOT_FOUND, code, message);
  }

  static conflict(code: string, message: string): AppException {
    return new AppException(HttpStatus.CONFLICT, code, message);
  }

  static unprocessable(code: string, message: string, details?: unknown): AppException {
    return new AppException(HttpStatus.UNPROCESSABLE_ENTITY, code, message, { details });
  }
}
