import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ErrorDetail } from '../errors/error-detail';

/**
 * Convierte los errores de class-validator en el formato uniforme de error,
 * conservando el campo y sus mensajes.
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): ErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const constraints = error.constraints
      ? Object.values(error.constraints)
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
