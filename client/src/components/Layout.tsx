import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/context';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/boards', label: 'Boards', end: false },
];

/**
 * App shell: top navigation bar + main content area. Kept deliberately
 * simple; auth-aware nav (user menu, logout) arrives with Phase 1.
 */
export function Layout({ children }: LayoutProps) {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-brand-600">
            <span aria-hidden className="text-xl">🗂️</span>
            <span>CollabBoard</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}

            {loading ? null : user ? (
              <div className="ml-2 flex items-center gap-2">
                <span className="hidden text-sm text-slate-600 sm:inline">
                  {user.name}
                </span>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-slate-100"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="ml-2 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 text-center text-sm text-slate-500">
          CollabBoard — realtime collaborative Kanban · MIT licensed
        </div>
      </footer>
    </div>
  );
}
