import { type ValidationError, ValidationPipe } from '@nestjs/common';

import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';

export interface FieldValidationError {
  field: string;
  errors: string[];
}

/** Flattens nested class-validator errors into `{ field: 'a.b', errors: [...] }` entries. */
export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): FieldValidationError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints ? [{ field, errors: Object.values(error.constraints) }] : [];
    const nested = error.children?.length ? flattenValidationErrors(error.children, field) : [];
    return [...own, ...nested];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    validationError: { target: false, value: false },
    exceptionFactory: (errors) =>
      AppException.badRequest(
        ErrorCode.VALIDATION_FAILED,
        'Request validation failed',
        flattenValidationErrors(errors),
      ),
  });
}
