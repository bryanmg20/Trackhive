import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { DomainError } from '../errors/domain.error';
import { InvalidRefreshTokenError } from '../../auth/domain/errors/invalid-refresh-token.error';
import { MailDeliveryFailedError } from '../../notifications/domain/errors/mail-delivery-failed.error';
import { EmailAlreadyExistsError } from '../../users/domain/errors/email-already-exists.error';
import { UserNotFoundError } from '../../users/domain/errors/user-not-found.error';
import { InvalidEmailError } from '../../users/domain/errors/invalid-email.error';
import { InvalidRequestStatusError } from '../../requests/domain/errors/invalid-request-status.error';
import { InvalidStatusTransitionError } from '../../requests/domain/errors/invalid-status-transition.error';
import { RejectionReasonRequiredError } from '../../requests/domain/errors/rejection-reason-required.error';
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

  it('responds to validation errors with per-field details', () => {
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

  it('maps an unstructured BadRequestException to a stable code', () => {
    run(new BadRequestException('Dato inválido'));

    expect(payload()).toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'BAD_REQUEST',
      message: 'Dato inválido',
      path: '/api/v1/users',
    });
    expect(payload()).not.toHaveProperty('details');
  });

  it('maps a domain error to its HTTP status', () => {
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

  it('maps a duplicate email to 409 Conflict', () => {
    run(new EmailAlreadyExistsError());

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(payload()).toMatchObject({
      statusCode: HttpStatus.CONFLICT,
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'Ya existe una cuenta con ese correo',
      path: '/api/v1/users',
    });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('maps an invalid refresh token to 401 Unauthorized', () => {
    run(new InvalidRefreshTokenError());

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(payload()).toMatchObject({
      statusCode: HttpStatus.UNAUTHORIZED,
      code: 'INVALID_REFRESH_TOKEN',
      message: 'La sesión no es válida o ya expiró',
    });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('maps a missing user to 404 Not Found', () => {
    run(new UserNotFoundError());

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(payload()).toMatchObject({
      code: 'USER_NOT_FOUND',
      message: 'El usuario no existe',
    });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('maps a mail server failure to 502 Bad Gateway', () => {
    run(new MailDeliveryFailedError());

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
    expect(payload()).toMatchObject({
      statusCode: HttpStatus.BAD_GATEWAY,
      code: 'MAIL_DELIVERY_FAILED',
      message: 'No se pudo enviar el correo. Revisa la configuración SMTP',
    });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('maps an invalid status transition to 409 Conflict', () => {
    run(new InvalidStatusTransitionError('RECIBIDA', 'ATENDIDA'));

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(payload()).toMatchObject({
      statusCode: HttpStatus.CONFLICT,
      code: 'INVALID_STATUS_TRANSITION',
      message: 'No se puede pasar una solicitud de Recibida a Atendida',
      path: '/api/v1/users',
    });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('maps a missing rejection reason to 400 Bad Request', () => {
    run(new RejectionReasonRequiredError());

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(payload()).toMatchObject({
      code: 'REJECTION_REASON_REQUIRED',
      message: 'El motivo del rechazo es obligatorio',
    });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('maps an unknown request status to 400 Bad Request', () => {
    run(new InvalidRequestStatusError());

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(payload()).toMatchObject({ code: 'INVALID_REQUEST_STATUS' });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('responds with 500 and logs an unmapped domain error', () => {
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

  it('does not leak internal details for an unknown error', () => {
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
