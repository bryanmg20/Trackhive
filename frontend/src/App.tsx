import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPlaceholderPage } from './features/auth/login/LoginPlaceholderPage';
import { RegisterPage } from './features/auth/register/RegisterPage';
import { ROUTES } from './routes';

function App() {
  return (
    <Routes>
      <Route path={ROUTES.register} element={<RegisterPage />} />
      <Route path={ROUTES.login} element={<LoginPlaceholderPage />} />
      <Route path="*" element={<Navigate replace to={ROUTES.register} />} />
    </Routes>
  );
}

export default App;
