import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../../../routes';
import { HOME_BY_ROLE } from '../role-home';
import { readSessionRole } from '../session';

/**
 * Screens only for ADMIN (HU-05). Other roles go back to their home screen.
 * The backend checks the role too: hiding a screen is not a permission.
 */
export function AdminRoute() {
  const role = readSessionRole();

  if (role === 'ADMIN') {
    return <Outlet />;
  }
  return <Navigate replace to={role ? HOME_BY_ROLE[role] : ROUTES.login} />;
}
