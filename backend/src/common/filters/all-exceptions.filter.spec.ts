import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { DomainError } from '../errors/domain.error';
import { InvalidEmailError } from '../../users/domain/errors/invalid-email.error';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface ErrorResponseBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Array<{ field: string; messages: string[] }>;
  timestamp: string;
  path: string;
}

class UnmappedDomainError extends DomainError {
  readonly code = 'UNMAPPED_DOMAIN_ERROR';

  constructor() {
    super('Error de dominio sin mapeo HTTP');
  }
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let logSpy: jest.SpyInstance;

  const run = (exception: unknown): void => {
    const request = { originalUrl: '/api/v1/users', url: '/api/v1/users' };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(exception, host);
  };

  const payload = (): ErrorResponseBody => {
    const calls = json.mock.calls as [ErrorResponseBody][];
    return calls[0][0];
  };

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('responde los errores de validación con detalles por campo', () => {
    run(
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'La petición contiene datos inválidos',
        details: [
          {
            field: 'email',
            messages: ['El correo no tiene un formato válido'],
          },
        ],
      }),
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(payload()).toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'VALIDATION_ERROR',
      message: 'La petición contiene datos inválidos',
      details: [
        {
          field: 'email',
          messages: ['El correo no tiene un formato válido'],
        },
      ],
      path: '/api/v1/users',
    });
    expect(payload().timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it('traduce un BadRequestException sin estructura a un código estable', () => {
    run(new BadRequestException('Dato inválido'));

    expect(payload()).toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'BAD_REQUEST',
      message: 'Dato inválido',
      path: '/api/v1/users',
    });
    expect(payload()).not.toHaveProperty('details');
  });

  it('traduce un error de dominio mapeado a su estado HTTP', () => {
    run(new InvalidEmailError());

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(payload()).toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'INVALID_EMAIL',
      message: 'El correo no tiene un formato válido',
      path: '/api/v1/users',
    });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('responde 500 y registra un error de dominio sin mapeo', () => {
    run(new UnmappedDomainError());

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(payload()).toMatchObject({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
      path: '/api/v1/users',
    });
    expect(logSpy).toHaveBeenCalled();
  });

  it('no filtra detalles internos ante un error desconocido', () => {
    run(new Error('contraseña de la base de datos'));

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(payload()).toMatchObject({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
      path: '/api/v1/users',
    });
    expect(JSON.stringify(payload())).not.toContain('contraseña');
    expect(logSpy).toHaveBeenCalled();
  });
});
