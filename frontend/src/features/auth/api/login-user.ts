export interface LoginUserInput {
  email: string;
  password: string;
}

export interface LoginSession {
  accessToken: string;
  refreshToken: string;
}

export class LoginApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'LoginApiError';
    this.status = status;
    this.code = code;
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const LOGIN_ENDPOINT = `${API_BASE_URL}/api/v1/auth/login`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function loginUser(input: LoginUserInput): Promise<LoginSession> {
  let response: Response;

  try {
    response = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new LoginApiError(
      0,
      'NETWORK_ERROR',
      'No se pudo conectar con el servidor.',
    );
  }

  const body = await readJson(response);

  if (response.ok) {
    if (
      isRecord(body) &&
      typeof body.accessToken === 'string' &&
      typeof body.refreshToken === 'string'
    ) {
      return {
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
      };
    }

    throw new LoginApiError(
      response.status,
      'INVALID_RESPONSE',
      'La respuesta del servidor no es válida.',
    );
  }

  const code =
    isRecord(body) && typeof body.code === 'string'
      ? body.code
      : `HTTP_${response.status}`;
  const message =
    isRecord(body) && typeof body.message === 'string' ? body.message : '';

  throw new LoginApiError(response.status, code, message);
}
