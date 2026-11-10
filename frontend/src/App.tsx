import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './features/auth/login/LoginPage';
import { RegisterPage } from './features/auth/register/RegisterPage';
import { ProtectedRoute } from './features/auth/components/ProtectedRoute';
import { StaffRoute } from './features/auth/components/StaffRoute';
import { NewRequestPage } from './features/requests/NewRequestPage';
import { StaffNewRequestPage } from './features/requests/StaffNewRequestPage';
import { MaterialSearchPage } from './features/materials/MaterialSearchPage';
import { StaffMaterialsPage } from './features/materials/StaffMaterialsPage';
import { RequestsListPage } from './features/requests/RequestsListPage';
import { ROUTES } from './routes';

function App() {
  return (
    <Routes>
      <Route path={ROUTES.register} element={<RegisterPage />} />
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path={ROUTES.newRequest} element={<NewRequestPage />} />
      </Route>
      <Route element={<StaffRoute />}>
        <Route path={ROUTES.staffMaterials} element={<StaffMaterialsPage />} />
        <Route path={ROUTES.requests} element={<RequestsListPage />} />
        <Route
          path={ROUTES.staffNewRequest}
          element={<StaffNewRequestPage />}
        />
      </Route>
      <Route path={ROUTES.materials} element={<MaterialSearchPage />} />
      <Route path="*" element={<Navigate replace to={ROUTES.register} />} />
    </Routes>
  );
}

export default App;
