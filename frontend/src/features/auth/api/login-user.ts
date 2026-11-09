export interface LoginInput {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export async function loginUser(input: LoginInput): Promise<LoginResponse> {
  let response: Response;
  try {
    response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }

  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'Correo o contraseña incorrectos.';
    throw new Error(message);
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('accessToken' in body) ||
    typeof body.accessToken !== 'string' ||
    !('refreshToken' in body) ||
    typeof body.refreshToken !== 'string'
  ) {
    throw new Error('El servidor devolvió una respuesta de inicio de sesión inválida.');
  }

  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
  };
}
