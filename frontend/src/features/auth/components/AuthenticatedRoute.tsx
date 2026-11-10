import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../../../routes';
import { readSessionRole } from '../session';

/** Screens shared by every signed-in role. A visitor goes to the login screen. */
export function AuthenticatedRoute() {
  const role = readSessionRole();

  return role ? <Outlet /> : <Navigate replace to={ROUTES.login} />;
}
