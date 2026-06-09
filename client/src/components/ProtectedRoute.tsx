import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/context';

/**
 * Route guard. Renders nested routes only when authenticated; otherwise
 * redirects to /login, preserving the attempted location so we can return
 * the user there after sign-in.
 */
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="py-16 text-center text-slate-400">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
