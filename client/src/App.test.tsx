import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { AuthProvider } from './auth/AuthProvider';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('App', () => {
  beforeEach(() => {
    // Default: not authenticated — every request 401.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the brand and home hero', async () => {
    renderAt('/');
    expect(screen.getAllByText(/CollabBoard/i).length).toBeGreaterThan(0);
    expect(
      await screen.findByRole('heading', { name: /plan together/i }),
    ).toBeInTheDocument();
  });

  it('renders a 404 for unknown routes', async () => {
    renderAt('/nope');
    expect(
      await screen.findByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument();
  });

  it('redirects unauthenticated users away from protected routes', async () => {
    renderAt('/boards');
    // ProtectedRoute should bounce to /login.
    expect(
      await screen.findByRole('heading', { name: /sign in/i }),
    ).toBeInTheDocument();
  });
});
