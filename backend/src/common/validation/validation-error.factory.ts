import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ErrorDetail } from '../errors/error-detail';

const WHITELIST_CONSTRAINT = 'whitelistValidation';

/**
 * Converts class-validator errors into the uniform error format,
 * preserving the field and its messages.
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): ErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const constraints = error.constraints
      ? Object.entries(error.constraints).map(([constraint, message]) =>
          constraint === WHITELIST_CONSTRAINT
            ? `El campo ${field} no está permitido.`
            : message,
        )
      : [];
    const own: ErrorDetail[] =
      constraints.length > 0 ? [{ field, messages: constraints }] : [];
    const children = error.children?.length
      ? flattenValidationErrors(error.children, field)
      : [];
    return [...own, ...children];
  });
}

export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'La petición contiene datos inválidos',
    details: flattenValidationErrors(errors),
  });
}
