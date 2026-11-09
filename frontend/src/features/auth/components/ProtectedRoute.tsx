import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../../../routes';
import { readAccessToken, readRoleFromToken } from '../session';

export function ProtectedRoute() {
  const token = readAccessToken();
  const role = token ? readRoleFromToken(token) : null;

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
