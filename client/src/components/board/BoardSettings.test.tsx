import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BoardSettings } from './BoardSettings';
import { type Board } from '../../lib/boards';

const board: Board = {
  id: 'b1',
  name: 'Design Board',
  description: 'UI work',
  owner: 'u1',
  members: [
    { user: 'u1', role: 'owner' },
    { user: 'u2', role: 'viewer' },
  ],
  createdAt: '2026-06-09T00:00:00.000Z',
  updatedAt: '2026-06-09T00:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const membersBody = {
  members: [
    {
      user: { id: 'u1', email: 'owner@test.com', name: 'Owner' },
      role: 'owner',
      isOwner: true,
    },
    {
      user: { id: 'u2', email: 'viewer@test.com', name: 'Vic Viewer' },
      role: 'viewer',
      isOwner: false,
    },
  ],
};

describe('BoardSettings', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.endsWith('/boards/b1/members') && method === 'GET') {
          return jsonResponse(membersBody);
        }
        if (url.endsWith('/boards/b1/members') && method === 'POST') {
          return jsonResponse({ board }, 201);
        }
        if (url.includes('/boards/b1/members/') && method === 'PATCH') {
          return jsonResponse({ board });
        }
        if (url.includes('/boards/b1/members/') && method === 'DELETE') {
          return jsonResponse({ board });
        }
        if (url.endsWith('/boards/b1') && method === 'PATCH') {
          return jsonResponse({ board: { ...board, name: 'Renamed' } });
        }
        return jsonResponse({ error: 'not found' }, 404);
      }),
    );
  });

  it('renders members and lets an owner invite by email', async () => {
    const onBoardUpdated = vi.fn();
    render(
      <BoardSettings
        board={board}
        canEdit
        isOwner
        onClose={() => {}}
        onBoardUpdated={onBoardUpdated}
      />,
    );

    // Resolved member name appears once loaded.
    expect(await screen.findByText('Vic Viewer')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/invitee email/i), {
      target: { value: 'new@test.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^invite$/i }));

    await waitFor(() => expect(onBoardUpdated).toHaveBeenCalled());
  });

  it('hides member management for non-owners', async () => {
    render(
      <BoardSettings
        board={board}
        canEdit
        isOwner={false}
        onClose={() => {}}
        onBoardUpdated={() => {}}
      />,
    );

    expect(await screen.findByText('Vic Viewer')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^invite$/i }),
    ).not.toBeInTheDocument();
  });
});
