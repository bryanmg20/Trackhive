import { ValidationError } from 'class-validator';
import {
  flattenValidationErrors,
  validationExceptionFactory,
} from './validation-error.factory';

const validationError = (
  property: string,
  constraints: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError => ({
  target: {},
  value: undefined,
  property,
  children,
  constraints,
});

describe('flattenValidationErrors', () => {
  it('keeps the field and messages, including nested ones', () => {
    const errors = [
      validationError('email', {
        isEmail: 'El correo no tiene un formato válido',
      }),
      validationError('address', {}, [
        validationError('city', {
          isNotEmpty: 'La ciudad es obligatoria',
        }),
      ]),
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      {
        field: 'email',
        messages: ['El correo no tiene un formato válido'],
      },
      {
        field: 'address.city',
        messages: ['La ciudad es obligatoria'],
      },
    ]);
  });

  it('translates the whitelist validation message for a forbidden field', () => {
    const errors = [
      validationError('role', {
        whitelistValidation: 'property role should not exist',
      }),
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      {
        field: 'role',
        messages: ['El campo role no está permitido.'],
      },
    ]);
  });

  it('creates a BadRequestException with the uniform format', () => {
    const exception = validationExceptionFactory([
      validationError('email', {
        isEmail: 'El correo no tiene un formato válido',
      }),
    ]);

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'La petición contiene datos inválidos',
      details: [
        {
          field: 'email',
          messages: ['El correo no tiene un formato válido'],
        },
      ],
    });
  });
});
