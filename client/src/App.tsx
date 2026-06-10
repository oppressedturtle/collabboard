import { Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastProvider } from './components/Toast';
import { BoardDetailPage } from './pages/BoardDetailPage';
import { BoardsPage } from './pages/BoardsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegisterPage } from './pages/RegisterPage';

/**
 * Application routes. The Router itself is provided by `main.tsx`
 * (BrowserRouter) and by tests (MemoryRouter), so this component stays
 * router-agnostic and easy to render in isolation.
 */
export default function App() {
  return (
    <ToastProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Authenticated-only routes. */}
          <Route element={<ProtectedRoute />}>
            <Route path="/boards" element={<BoardsPage />} />
            <Route path="/boards/:id" element={<BoardDetailPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </ToastProvider>
  );
}
