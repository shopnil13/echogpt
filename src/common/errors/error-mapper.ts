import { HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

import { AppException } from './app.exception';
import { ErrorCode } from './error-codes';

export interface MappedError {
  status: number;
  code: string;
  message: string;
  details: unknown;
  headers: Record<string, string>;
}

const GENERIC_CODE_BY_STATUS: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.PAYLOAD_TOO_LARGE,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.UNPROCESSABLE_ENTITY,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
};

const INTERNAL_ERROR_MESSAGE = 'An unexpected error occurred';

/** Extra mappers (e.g. Prisma) register here so the filter stays closed for modification. */
export type ErrorMapper = (exception: unknown) => MappedError | null;

export function mapAppException(exception: unknown): MappedError | null {
  if (!(exception instanceof AppException)) return null;
  return {
    status: exception.getStatus(),
    code: exception.code,
    message: exception.message,
    details: exception.details,
    headers: exception.headers,
  };
}

export function mapHttpException(exception: unknown): MappedError | null {
  if (!(exception instanceof HttpException)) return null;
  const status = exception.getStatus();
  if (exception instanceof ThrottlerException) {
    return {
      status,
      code: ErrorCode.RATE_LIMITED,
      message: 'Too many requests, please slow down',
      details: null,
      headers: {},
    };
  }
  const code =
    GENERIC_CODE_BY_STATUS[status] ??
    (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST);
  const message = status >= 500 ? INTERNAL_ERROR_MESSAGE : extractHttpMessage(exception);
  return { status, code, message, details: null, headers: {} };
}

/** body-parser errors (malformed JSON, oversized body) are plain errors with `type` and `status`. */
export function mapBodyParserError(exception: unknown): MappedError | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const { type, status } = exception as { type?: unknown; status?: unknown };
  if (type === 'entity.too.large') {
    return {
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      code: ErrorCode.PAYLOAD_TOO_LARGE,
      message: 'Request body is too large',
      details: null,
      headers: {},
    };
  }
  if (
    type === 'entity.parse.failed' ||
    (typeof status === 'number' && status === 400 && typeof type === 'string')
  ) {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: ErrorCode.BAD_REQUEST,
      message: 'Malformed request body',
      details: null,
      headers: {},
    };
  }
  return null;
}

export function internalError(): MappedError {
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ErrorCode.INTERNAL_ERROR,
    message: INTERNAL_ERROR_MESSAGE,
    details: null,
    headers: {},
  };
}

function extractHttpMessage(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') return response;
  const message = (response as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map(String).join('; ');
  return exception.message;
}
