import { HttpStatus, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

import { AppException } from './app.exception';
import { ErrorCode } from './error-codes';
import {
  internalError,
  mapAppException,
  mapBodyParserError,
  mapHttpException,
} from './error-mapper';

describe('error mappers', () => {
  it('keeps the code, details and headers of an AppException', () => {
    const exception = new AppException(
      HttpStatus.TOO_MANY_REQUESTS,
      'QUOTA_EXCEEDED',
      'Quota exceeded',
      {
        details: { limit: 20 },
        headers: { 'Retry-After': '60' },
      },
    );

    expect(mapAppException(exception)).toEqual({
      status: 429,
      code: 'QUOTA_EXCEEDED',
      message: 'Quota exceeded',
      details: { limit: 20 },
      headers: { 'Retry-After': '60' },
    });
  });

  it('maps Nest HTTP exceptions to generic codes', () => {
    expect(mapHttpException(new NotFoundException('Missing'))).toMatchObject({
      status: 404,
      code: ErrorCode.NOT_FOUND,
      message: 'Missing',
    });
  });

  it('maps throttler errors to RATE_LIMITED', () => {
    expect(mapHttpException(new ThrottlerException())).toMatchObject({
      status: 429,
      code: ErrorCode.RATE_LIMITED,
    });
  });

  it('hides messages of 5xx HTTP exceptions', () => {
    const mapped = mapHttpException(new AppException(500, 'X', 'secret detail'));
    expect(mapped?.message).toBe('An unexpected error occurred');
  });

  it('maps oversized bodies to 413', () => {
    expect(mapBodyParserError({ type: 'entity.too.large', status: 413 })).toMatchObject({
      status: 413,
      code: ErrorCode.PAYLOAD_TOO_LARGE,
    });
  });

  it('ignores errors it does not recognise', () => {
    expect(mapAppException(new Error('x'))).toBeNull();
    expect(mapHttpException(new Error('x'))).toBeNull();
    expect(mapBodyParserError(new Error('x'))).toBeNull();
    expect(internalError()).toMatchObject({ status: 500, code: ErrorCode.INTERNAL_ERROR });
  });
});
