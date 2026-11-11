import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from '../errors/domain.error';
import { ErrorDetail } from '../errors/error-detail';

interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: ErrorDetail[];
  logError?: unknown;
}

const INTERNAL_ERROR_MESSAGE = 'Error interno del servidor';

/** HTTP status codes mapped to a stable API code. */
const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
};

/**
 * Domain code -> HTTP status. Every new domain error requires a line here;
 * otherwise it is returned as a 500 and logged.
 */
const STATUS_BY_DOMAIN_CODE: Record<string, HttpStatus> = {
  INVALID_EMAIL: HttpStatus.BAD_REQUEST,
  INVALID_NAME: HttpStatus.BAD_REQUEST,
  INVALID_PASSWORD_HASH: HttpStatus.BAD_REQUEST,
  INVALID_PRIVACY_CONSENT: HttpStatus.BAD_REQUEST,
  INVALID_ROLE: HttpStatus.BAD_REQUEST,
  PRIVACY_CONSENT_REQUIRED: HttpStatus.BAD_REQUEST,
  EMAIL_ALREADY_EXISTS: HttpStatus.CONFLICT,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  INVALID_REFRESH_TOKEN: HttpStatus.UNAUTHORIZED,
  INVALID_REQUEST_STATUS: HttpStatus.BAD_REQUEST,
  REJECTION_REASON_REQUIRED: HttpStatus.BAD_REQUEST,
  INVALID_STATUS_TRANSITION: HttpStatus.CONFLICT,
  REQUEST_STATUS_CONFLICT: HttpStatus.CONFLICT,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_DESIRED_DATE: HttpStatus.BAD_REQUEST,
  INVALID_APPOINTMENT_DATE: HttpStatus.BAD_REQUEST,
  REQUEST_MATERIALS_REQUIRED: HttpStatus.BAD_REQUEST,
  REQUEST_MATERIAL_NOT_FOUND: HttpStatus.NOT_FOUND,
  REQUEST_NOT_FOUND: HttpStatus.NOT_FOUND,
  MATERIAL_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_MATERIAL_STATUS: HttpStatus.BAD_REQUEST,
  // A material cannot be scheduled twice the same day (HU-20)
  MATERIAL_ALREADY_BOOKED: HttpStatus.CONFLICT,
  MATERIAL_NOT_AVAILABLE: HttpStatus.CONFLICT,
  REQUESTER_NOT_FOUND: HttpStatus.NOT_FOUND,
  REQUESTER_USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  REQUESTER_NAME_REQUIRED: HttpStatus.BAD_REQUEST,
  REQUESTER_EMAIL_REQUIRED: HttpStatus.BAD_REQUEST,
  REQUESTER_EMAIL_MISMATCH: HttpStatus.BAD_REQUEST,
  // The mail server failed, not the request: like a proxy, answer 502
  MAIL_DELIVERY_FAILED: HttpStatus.BAD_GATEWAY,
};

function codeFromStatus(statusCode: number): string {
  return CODE_BY_STATUS[statusCode] ?? `HTTP_${statusCode}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeDetails(value: unknown): ErrorDetail[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const details = value
    .filter(isRecord)
    .map((detail) => ({
      field: typeof detail.field === 'string' ? detail.field : '',
      messages: Array.isArray(detail.messages)
        ? detail.messages.map(String)
        : [],
    }))
    .filter((detail) => detail.messages.length > 0);
  return details.length > 0 ? details : undefined;
}

/**
 * Translates HTTP exceptions and domain errors into the uniform format:
 * `{ statusCode, code, message, details?, timestamp, path }`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const error = this.normalize(exception);

    if (error.logError) {
      const stack =
        error.logError instanceof Error ? error.logError.stack : undefined;
      this.logger.error(
        `Unhandled exception at ${request.originalUrl ?? request.url}`,
        stack,
      );
    }

    response.status(error.statusCode).json({
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
    });
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof DomainError) {
      return this.fromDomainError(exception);
    }
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: INTERNAL_ERROR_MESSAGE,
      logError: exception,
    };
  }

  private fromDomainError(exception: DomainError): NormalizedError {
    const statusCode = STATUS_BY_DOMAIN_CODE[exception.code];
    if (statusCode) {
      return {
        statusCode,
        code: exception.code,
        message: exception.message,
      };
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: INTERNAL_ERROR_MESSAGE,
      logError: exception,
    };
  }

  private fromHttpException(exception: HttpException): NormalizedError {
    const statusCode = exception.getStatus();
    const body = exception.getResponse();

    if (typeof body === 'string') {
      return { statusCode, code: codeFromStatus(statusCode), message: body };
    }

    const record = isRecord(body) ? body : {};
    const code =
      typeof record.code === 'string'
        ? record.code
        : codeFromStatus(statusCode);
    const details = normalizeDetails(record.details);
    const message = this.messageFromRecord(record, exception.message);

    return {
      statusCode,
      code,
      message,
      ...(details ? { details } : {}),
      ...(statusCode >= 500 ? { logError: exception } : {}),
    };
  }

  private messageFromRecord(
    record: Record<string, unknown>,
    fallback: string,
  ): string {
    if (typeof record.message === 'string') {
      return record.message;
    }
    if (Array.isArray(record.message)) {
      return record.message.map(String).join('; ');
    }
    return fallback;
  }
}
