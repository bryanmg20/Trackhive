import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../../../routes';

function getTokenRole(token: string | null): string | null {
  if (!token) {
    return null;
  }

  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }

    const normalizedPayload = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const claims: unknown = JSON.parse(atob(normalizedPayload));
    if (
      typeof claims !== 'object' ||
      claims === null ||
      !('role' in claims) ||
      typeof claims.role !== 'string' ||
      !('exp' in claims) ||
      typeof claims.exp !== 'number' ||
      claims.exp * 1000 <= Date.now()
    ) {
      return null;
    }

    return claims.role;
  } catch {
    return null;
  }
}

export function ProtectedRoute() {
  const token = localStorage.getItem('accessToken');
  const role = getTokenRole(token);

  return role === 'PUBLICO' ? (
    <Outlet />
  ) : (
    <Navigate
      replace
      to={ROUTES.login}
      state={{ accessDenied: Boolean(token) }}
    />
  );
}
