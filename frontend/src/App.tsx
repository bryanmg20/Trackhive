import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './features/auth/login/LoginPage';
import { RegisterPage } from './features/auth/register/RegisterPage';
import { ProtectedRoute } from './features/auth/components/ProtectedRoute';
import { NewRequestPage } from './features/requests/NewRequestPage';
import { PendingPage } from './features/pending/PendingPage';
import { ROUTES } from './routes';

function App() {
  return (
    <Routes>
      <Route path={ROUTES.register} element={<RegisterPage />} />
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path={ROUTES.newRequest} element={<NewRequestPage />} />
      </Route>
      <Route
        path={ROUTES.materials}
        element={
          <PendingPage title="Buscar material" spineLabel="CONSULTA · MATERIAL" />
        }
      />
      <Route
        path={ROUTES.requests}
        element={
          <PendingPage title="Solicitudes" spineLabel="PERSONAL · SOLICITUDES" />
        }
      />
      <Route path="*" element={<Navigate replace to={ROUTES.register} />} />
    </Routes>
  );
}

export default App;
