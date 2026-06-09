import { Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { BoardsPage } from './pages/BoardsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * Application routes. The Router itself is provided by `main.tsx`
 * (BrowserRouter) and by tests (MemoryRouter), so this component stays
 * router-agnostic and easy to render in isolation.
 */
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
