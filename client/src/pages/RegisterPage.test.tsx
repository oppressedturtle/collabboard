import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { ToastProvider } from '../components/Toast';
import { RegisterPage } from './RegisterPage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthProvider>
        <ToastProvider>
          <RegisterPage />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('RegisterPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders name, email and password fields', () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ user: null }, 401)));
    renderRegister();
    // Name is an unlabelled text input; check by type + surrounding context
    expect(screen.getByText(/name/i)).toBeInTheDocument();
    expect(screen.getByText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows an error message on failed registration (409)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ error: 'Email already in use' }, 409),
      ),
    );
    renderRegister();

    // Fill all required fields to satisfy HTML5 validation
    const inputs = document.querySelectorAll('input');
    inputs.forEach((input, i) => {
      const values = ['Alice', 'alice@test.com', 'password123'];
      fireEvent.change(input, { target: { value: values[i] ?? '' } });
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
