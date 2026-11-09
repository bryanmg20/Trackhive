import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../../../routes';

export function ProtectedRoute() {
  const token = localStorage.getItem('accessToken');
  return token ? <Outlet /> : <Navigate replace to={ROUTES.login} />;
}
