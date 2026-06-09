import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from './AuthProvider';
import { useAuth } from './context';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function Consumer() {
  const { user, loading, login } = useAuth();
  if (loading) return <p>loading</p>;
  return (
    <div>
      <p data-testid="user">{user ? user.email : 'anonymous'}</p>
      <button onClick={() => void login('a@b.com', 'password123')}>login</button>
    </div>
  );
}

describe('AuthProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    // Route the mock by URL + method.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.endsWith('/auth/me')) {
          return jsonResponse({ error: 'unauthorized' }, 401);
        }
        if (url.endsWith('/auth/login') && method === 'POST') {
          return jsonResponse({
            user: { id: '1', email: 'a@b.com', name: 'Ada' },
          });
        }
        return jsonResponse({ error: 'not found' }, 404);
      }),
    );
  });

  it('starts anonymous then becomes the user after login', async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    // After bootstrap (401), we are anonymous.
    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent('anonymous'),
    );

    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent('a@b.com'),
    );
  });
});
