import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../../../routes';
import { readAccessToken, readRoleFromToken } from '../session';

/** Screens only for the staff: PERSONAL and ADMIN. The backend checks the role too. */
export function StaffRoute() {
  const token = readAccessToken();
  const role = token ? readRoleFromToken(token) : null;

  if (role === 'PERSONAL' || role === 'ADMIN') {
    return <Outlet />;
  }
  return <Navigate replace to={role ? ROUTES.materials : ROUTES.login} />;
}
