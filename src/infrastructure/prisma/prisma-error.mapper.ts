import { HttpStatus } from '@nestjs/common';

import { ErrorCode } from '../../common/errors/error-codes';
import type { MappedError } from '../../common/errors/error-mapper';
import { Prisma } from '../../generated/prisma/client';

/**
 * Translates known Prisma errors into API errors. Services should still check business rules
 * explicitly; this is the backstop for races the database catches (unique, FK, missing row).
 */
export function mapPrismaError(exception: unknown): MappedError | null {
  if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) return null;

  switch (exception.code) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        code: ErrorCode.CONFLICT,
        message: 'A resource with the same unique value already exists',
        details: null,
        headers: {},
      };
    case 'P2003':
      return {
        status: HttpStatus.CONFLICT,
        code: ErrorCode.CONFLICT,
        message: 'The operation conflicts with a related resource',
        details: null,
        headers: {},
      };
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        code: ErrorCode.NOT_FOUND,
        message: 'Resource not found',
        details: null,
        headers: {},
      };
    default:
      return null;
  }
}
