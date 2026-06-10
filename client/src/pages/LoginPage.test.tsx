import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { ToastProvider } from '../components/Toast';
import { LoginPage } from './LoginPage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <ToastProvider>
          <LoginPage />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders email, password fields and submit button', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ user: null }, 401)),
    );
    renderLogin();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows an error message on failed login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ error: 'Invalid credentials' }, 401),
      ),
    );
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('calls /auth/login with the entered credentials', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/login'))
        return jsonResponse({ user: { id: 'u1', email: 'a@b.com', name: 'Alice' } });
      if (url.includes('/auth/me'))
        return jsonResponse({ user: { id: 'u1', email: 'a@b.com', name: 'Alice' } });
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
