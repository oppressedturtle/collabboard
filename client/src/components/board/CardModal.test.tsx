import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../Toast';
import { CardModal } from './CardModal';

vi.mock('socket.io-client', () => {
  const socket = { connected: false, connect: vi.fn(), disconnect: vi.fn(), emit: vi.fn(), on: vi.fn(), off: vi.fn() };
  return { io: vi.fn(() => socket) };
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const CARD = {
  id: 'c1',
  board: 'b1',
  list: 'l1',
  title: 'Fix the bug',
  description: 'Steps to reproduce…',
  labels: ['bug'],
  assignees: [],
  dueDate: null,
  position: 0,
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function stubFetch(overrides: Record<string, unknown> = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/activity')) return jsonResponse({ activities: [] });
    if (url.includes('/comments')) return jsonResponse({ comments: [] });
    if (url.includes('/cards/') && String((overrides['method'] ?? 'GET')).toUpperCase() === 'PATCH')
      return jsonResponse({ card: CARD });
    return jsonResponse({});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderModal(props: Partial<Parameters<typeof CardModal>[0]> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onDeleted = vi.fn();

  render(
    <ToastProvider>
      <CardModal
        boardId="b1"
        card={CARD}
        canEdit={true}
        currentUserId="u1"
        isBoardOwner={true}
        onClose={onClose}
        onSaved={onSaved}
        onDeleted={onDeleted}
        {...props}
      />
    </ToastProvider>,
  );

  return { onClose, onSaved, onDeleted };
}

describe('CardModal', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders the card title', async () => {
    const fetchMock = stubFetch();
    renderModal();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByDisplayValue('Fix the bug')).toBeInTheDocument();
  });

  it('renders comments section after loading', async () => {
    stubFetch();
    renderModal();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /comments/i })).toBeInTheDocument();
    });
  });

  it('calls onClose when the close button is clicked', async () => {
    stubFetch();
    const { onClose } = renderModal();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const closeBtn = screen.getByRole('button', { name: /close/i });
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay backdrop is clicked', async () => {
    stubFetch();
    const { onClose } = renderModal();
    const dialog = screen.getByRole('dialog');
    await userEvent.click(dialog);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls PATCH when Save is clicked', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/activity')) return jsonResponse({ activities: [] });
      if (url.includes('/comments')) return jsonResponse({ comments: [] });
      if (init?.method === 'PATCH') return jsonResponse({ card: CARD });
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    renderModal();
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/cards/c1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('calls DELETE and onDeleted when Delete card is clicked', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/activity')) return jsonResponse({ activities: [] });
      if (url.includes('/comments')) return jsonResponse({ comments: [] });
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    const { onDeleted } = renderModal();
    await waitFor(() => expect(screen.getByRole('button', { name: /delete card/i })).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /delete card/i }));
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith('c1');
    });
  });
});
