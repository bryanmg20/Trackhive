import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../../../routes';
import { HOME_BY_ROLE } from '../role-home';
import { readSessionRole } from '../session';

/** Screens exclusive to ADMIN. The backend checks the role too. */
export function AdminRoute() {
  const role = readSessionRole();

  if (role === 'ADMIN') {
    return <Outlet />;
  }
  return <Navigate replace to={role ? HOME_BY_ROLE[role] : ROUTES.login} />;
}
