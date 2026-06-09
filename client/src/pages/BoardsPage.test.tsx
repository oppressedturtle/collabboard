import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BoardsPage } from './BoardsPage';

function board(id: string, name: string) {
  return {
    id,
    name,
    description: '',
    owner: 'u1',
    members: [{ user: 'u1', role: 'owner' }],
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z',
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('BoardsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.endsWith('/boards') && method === 'GET') {
          return jsonResponse({ boards: [board('1', 'Existing Board')] });
        }
        if (url.endsWith('/boards') && method === 'POST') {
          return jsonResponse({ board: board('2', 'Fresh Board') }, 201);
        }
        return jsonResponse({ error: 'not found' }, 404);
      }),
    );
  });

  it('lists existing boards and creates a new one', async () => {
    render(
      <MemoryRouter>
        <BoardsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Existing Board')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/new board name/i), {
      target: { value: 'Fresh Board' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create board/i }));

    await waitFor(() =>
      expect(screen.getByText('Fresh Board')).toBeInTheDocument(),
    );
  });
});
