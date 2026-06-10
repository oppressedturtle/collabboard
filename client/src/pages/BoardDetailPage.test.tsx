import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { ToastProvider } from '../components/Toast';
import { BoardDetailPage } from './BoardDetailPage';

// Mock socket.io-client so it never tries to connect in jsdom.
vi.mock('socket.io-client', () => {
  const socket = {
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
  return { io: vi.fn(() => socket) };
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const BOARD = {
  id: '1',
  name: 'My Board',
  description: '',
  owner: 'u1',
  members: [{ user: 'u1', role: 'owner' }],
  createdAt: '',
  updatedAt: '',
};

const LIST = {
  id: 'l1',
  board: '1',
  title: 'To Do',
  position: 0,
  createdAt: '',
  updatedAt: '',
};

const CARD = {
  id: 'c1',
  board: '1',
  list: 'l1',
  title: 'First card',
  description: '',
  labels: [],
  assignees: [],
  dueDate: null,
  position: 0,
  version: 0,
  createdAt: '',
  updatedAt: '',
};

describe('BoardDetailPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/me'))
          return jsonResponse({ user: { id: 'u1', email: 'a@b.com', name: 'Ada' } });
        if (url.endsWith('/boards/1/lists'))
          return jsonResponse({ lists: [LIST] });
        if (url.endsWith('/boards/1/cards'))
          return jsonResponse({ cards: [CARD] });
        if (url.endsWith('/boards/1'))
          return jsonResponse({ board: BOARD });
        if (url.includes('/activity'))
          return jsonResponse({ activities: [] });
        if (url.includes('/comments'))
          return jsonResponse({ comments: [] });
        return jsonResponse({ error: 'not found' }, 404);
      }),
    );
  });

  function render_board() {
    return render(
      <MemoryRouter initialEntries={['/boards/1']}>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path="/boards/:id" element={<BoardDetailPage />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
  }

  it('renders the board, its lists, and an add-list form for editors', async () => {
    render_board();
    expect(
      await screen.findByRole('heading', { name: 'My Board' }),
    ).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('First card')).toBeInTheDocument();
    // Owner ⇒ can edit ⇒ add-list + add-card forms present.
    expect(screen.getByPlaceholderText(/add a list/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/add a card/i)).toBeInTheDocument();
  });

  it('opens the card detail modal when a card is clicked', async () => {
    render_board();
    fireEvent.click(await screen.findByText('First card'));
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toBeInTheDocument(),
    );
    expect(
      screen.getByPlaceholderText(/more detailed description/i),
    ).toBeInTheDocument();
  });

  it('shows the search/filter bar', async () => {
    render_board();
    await screen.findByRole('heading', { name: 'My Board' });
    expect(
      screen.getByPlaceholderText(/search cards/i),
    ).toBeInTheDocument();
  });

  it('filters cards by search text', async () => {
    render_board();
    await screen.findByText('First card');
    const search = screen.getByPlaceholderText(/search cards/i);
    fireEvent.change(search, { target: { value: 'xyz not matching' } });
    expect(screen.queryByText('First card')).not.toBeInTheDocument();
  });
});
