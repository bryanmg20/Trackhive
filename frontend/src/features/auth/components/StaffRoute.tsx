import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../../../routes';
import { readSessionRole } from '../session';

/** Screens only for the staff: PERSONAL and ADMIN. The backend checks the role too. */
export function StaffRoute() {
  const role = readSessionRole();

  if (role === 'PERSONAL' || role === 'ADMIN') {
    return <Outlet />;
  }
  return <Navigate replace to={role ? ROUTES.materials : ROUTES.login} />;
}
