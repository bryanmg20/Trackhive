import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../../../routes';
import { readSessionRole } from '../session';

/** Only a PUBLICO account can open these screens. */
export function ProtectedRoute() {
  const role = readSessionRole();

  return role === 'PUBLICO' ? (
    <Outlet />
  ) : (
    <Navigate
      replace
      to={ROUTES.login}
      state={{ accessDenied: role !== null }}
    />
  );
}
