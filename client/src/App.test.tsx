import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import App from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('renders the brand and home hero', () => {
    renderAt('/');
    // Brand appears in the nav.
    expect(screen.getAllByText(/CollabBoard/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('heading', { name: /plan together/i }),
    ).toBeInTheDocument();
  });

  it('renders a 404 for unknown routes', () => {
    renderAt('/nope');
    expect(
      screen.getByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument();
  });
});
