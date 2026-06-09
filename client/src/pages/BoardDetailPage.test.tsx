import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { BoardDetailPage } from './BoardDetailPage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('BoardDetailPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/me')) {
          return jsonResponse({
            user: { id: 'u1', email: 'a@b.com', name: 'Ada' },
          });
        }
        if (url.endsWith('/boards/1/lists')) {
          return jsonResponse({
            lists: [
              {
                id: 'l1',
                board: '1',
                title: 'To Do',
                position: 0,
                createdAt: '',
                updatedAt: '',
              },
            ],
          });
        }
        if (url.endsWith('/boards/1/cards')) {
          return jsonResponse({
            cards: [
              {
                id: 'c1',
                board: '1',
                list: 'l1',
                title: 'First card',
                description: '',
                labels: [],
                assignees: [],
                dueDate: null,
                position: 0,
                createdAt: '',
                updatedAt: '',
              },
            ],
          });
        }
        if (url.endsWith('/boards/1')) {
          return jsonResponse({
            board: {
              id: '1',
              name: 'My Board',
              description: '',
              owner: 'u1',
              members: [{ user: 'u1', role: 'owner' }],
              createdAt: '',
              updatedAt: '',
            },
          });
        }
        return jsonResponse({ error: 'not found' }, 404);
      }),
    );
  });

  it('renders the board, its lists, and an add-list form for editors', async () => {
    render(
      <MemoryRouter initialEntries={['/boards/1']}>
        <AuthProvider>
          <Routes>
            <Route path="/boards/:id" element={<BoardDetailPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'My Board' }),
    ).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('First card')).toBeInTheDocument();
    // Owner ⇒ can edit ⇒ add-list + add-card forms present.
    expect(screen.getByPlaceholderText(/add a list/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/add a card/i)).toBeInTheDocument();
  });
});
