import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles/global.css';
import App from './App.tsx';

// A data router (instead of <BrowserRouter>) so screens can ask before
// leaving with unsaved changes (useBlocker). The screens are still declared
// with <Routes> inside <App />, under this single catch-all route.
const router = createBrowserRouter([{ path: '*', element: <App /> }]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
