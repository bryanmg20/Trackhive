export interface RequestApiErrorDetail {
  field: string;
  messages: string[];
}

export class RequestApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: RequestApiErrorDetail[];

  constructor(
    status: number,
    code: string,
    message: string,
    details: RequestApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'RequestApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readDetails(value: unknown): RequestApiErrorDetail[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((detail) => {
    if (!isRecord(detail)) {
      return [];
    }

    const field = typeof detail.field === 'string' ? detail.field : '';
    const messages = Array.isArray(detail.messages)
      ? detail.messages.filter(
          (message): message is string => typeof message === 'string',
        )
      : [];

    return field && messages.length > 0 ? [{ field, messages }] : [];
  });
}

function readMessage(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(String).join('; ');
  }
  return '';
}

/** Translates the backend error body into a typed error with field details. */
export async function readRequestApiError(
  response: Response,
): Promise<RequestApiError> {
  try {
    const body: unknown = await response.json();

    if (isRecord(body)) {
      return new RequestApiError(
        response.status,
        typeof body.code === 'string'
          ? body.code
          : `HTTP_${response.status}`,
        readMessage(body.message) ||
          'La operación no pudo completarse. Inténtelo de nuevo.',
        readDetails(body.details),
      );
    }
  } catch {
    // The response did not contain JSON.
  }

  return new RequestApiError(
    response.status,
    `HTTP_${response.status}`,
    'La operación no pudo completarse. Inténtelo de nuevo.',
  );
}

export function networkRequestApiError(): RequestApiError {
  return new RequestApiError(0, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE);
}
