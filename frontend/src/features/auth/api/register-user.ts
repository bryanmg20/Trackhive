export interface RegisterUserInput {
  fullName: string;
  email: string;
  password: string;
}

export interface ApiErrorDetail {
  field: string;
  messages: string[];
}

export class RegisterApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(
    status: number,
    code: string,
    message: string,
    details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'RegisterApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ErrorBody {
  code: string;
  message: string;
  details: ApiErrorDetail[];
}

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const REGISTER_ENDPOINT = `${API_BASE_URL}/api/v1/users`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readDetails(value: unknown): ApiErrorDetail[] {
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

async function readErrorBody(response: Response): Promise<ErrorBody> {
  try {
    const body: unknown = await response.json();

    if (isRecord(body)) {
      return {
        code:
          typeof body.code === 'string'
            ? body.code
            : `HTTP_${response.status}`,
        message: typeof body.message === 'string' ? body.message : '',
        details: readDetails(body.details),
      };
    }
  } catch {
    // The response did not contain JSON; fall back to a generic error below.
  }

  return {
    code: `HTTP_${response.status}`,
    message: '',
    details: [],
  };
}

export async function registerUser(input: RegisterUserInput): Promise<void> {
  let response: Response;

  try {
    response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new RegisterApiError(
      0,
      'NETWORK_ERROR',
      'No se pudo conectar con el servidor.',
    );
  }

  if (response.ok) {
    return;
  }

  const body = await readErrorBody(response);
  throw new RegisterApiError(
    response.status,
    body.code,
    body.message,
    body.details,
  );
}
