/**
 * Integration tests — all DB-dependent routes exercised against a real
 * in-memory MongoDB instance. Covers auth, boards, lists, cards, and comments.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { clearTestDb, startTestDb, stopTestDb } from './db.js';

beforeAll(async () => { await startTestDb(); }, 90_000);
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

const app = createApp();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function registerAndLogin(email: string, password = 'password123', name = 'Test User') {
  await request(app).post('/auth/register').send({ email, password, name });
  const res = await request(app).post('/auth/login').send({ email, password });
  // Extract cookie or token
  const cookies = res.headers['set-cookie'] as string[] | string | undefined;
  const cookieArr = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
  const accessCookie = cookieArr.find((c) => c.startsWith('access_token='));
  const token = accessCookie ? accessCookie.split(';')[0]?.split('=')?.[1] : undefined;
  return { token: token ?? '', cookies: cookieArr, userId: (res.body as { user?: { id?: string } }).user?.id ?? '' };
}

async function auth(email: string) {
  const { token, cookies } = await registerAndLogin(email);
  return { auth: `Bearer ${token}`, cookies };
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

describe('auth routes', () => {
  it('registers a new user (201)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'alice@test.com', password: 'password123', name: 'Alice' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@test.com');
  });

  it('rejects duplicate email on register (409)', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'alice@test.com', password: 'password123', name: 'Alice' });
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'alice@test.com', password: 'password123', name: 'Alice2' });
    expect(res.status).toBe(409);
  });

  it('logs in with valid credentials (200)', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'bob@test.com', password: 'password123', name: 'Bob' });
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'bob@test.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('bob@test.com');
  });

  it('rejects wrong password (401)', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'bob@test.com', password: 'password123', name: 'Bob' });
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'bob@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns current user from /auth/me (200)', async () => {
    const { auth: bearer } = await auth('carol@test.com');
    const res = await request(app).get('/auth/me').set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('carol@test.com');
  });

  it('clears cookies on logout (200)', async () => {
    const { auth: bearer } = await auth('dave@test.com');
    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', bearer);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Board routes
// ---------------------------------------------------------------------------

describe('board routes', () => {
  it('creates a board (201)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const res = await request(app)
      .post('/boards')
      .set('Authorization', bearer)
      .send({ name: 'My Board' });
    expect(res.status).toBe(201);
    expect(res.body.board.name).toBe('My Board');
    expect(res.body.board.members).toHaveLength(1);
  });

  it('lists boards for the current user (200)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    await request(app)
      .post('/boards')
      .set('Authorization', bearer)
      .send({ name: 'Board A' });
    const res = await request(app).get('/boards').set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.body.boards).toHaveLength(1);
  });

  it('reads a board by id (200)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const created = await request(app)
      .post('/boards')
      .set('Authorization', bearer)
      .send({ name: 'Board X' });
    const id = (created.body as { board: { id: string } }).board.id;
    const res = await request(app)
      .get(`/boards/${id}`)
      .set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.body.board.id).toBe(id);
  });

  it('updates a board name (200)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const created = await request(app)
      .post('/boards')
      .set('Authorization', bearer)
      .send({ name: 'Old Name' });
    const id = (created.body as { board: { id: string } }).board.id;
    const res = await request(app)
      .patch(`/boards/${id}`)
      .set('Authorization', bearer)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.board.name).toBe('New Name');
  });

  it('invites a member by email (201)', async () => {
    const { auth: ownerAuth } = await auth('owner@test.com');
    const { userId: memberId } = await registerAndLogin('member@test.com');
    const created = await request(app)
      .post('/boards')
      .set('Authorization', ownerAuth)
      .send({ name: 'Shared Board' });
    const id = (created.body as { board: { id: string } }).board.id;
    const res = await request(app)
      .post(`/boards/${id}/members`)
      .set('Authorization', ownerAuth)
      .send({ email: 'member@test.com', role: 'editor' });
    expect(res.status).toBe(201);
    const members = (res.body as { board: { members: Array<{ user: string }> } }).board.members;
    expect(members.some((m) => m.user === memberId)).toBe(true);
  });

  it('rejects invite for non-existent user (404)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const created = await request(app)
      .post('/boards')
      .set('Authorization', bearer)
      .send({ name: 'Board' });
    const id = (created.body as { board: { id: string } }).board.id;
    const res = await request(app)
      .post(`/boards/${id}/members`)
      .set('Authorization', bearer)
      .send({ email: 'nobody@test.com', role: 'editor' });
    expect(res.status).toBe(404);
  });

  it('non-members receive 404 (not 403)', async () => {
    const { auth: ownerAuth } = await auth('owner@test.com');
    const { auth: otherAuth } = await auth('other@test.com');
    const created = await request(app)
      .post('/boards')
      .set('Authorization', ownerAuth)
      .send({ name: 'Private Board' });
    const id = (created.body as { board: { id: string } }).board.id;
    const res = await request(app)
      .get(`/boards/${id}`)
      .set('Authorization', otherAuth);
    expect(res.status).toBe(404);
  });

  it('lists members with resolved name/email (200)', async () => {
    const { auth: ownerAuth } = await auth('owner@test.com');
    await registerAndLogin('member@test.com', 'password123', 'Mary Member');
    const created = await request(app)
      .post('/boards')
      .set('Authorization', ownerAuth)
      .send({ name: 'Team Board' });
    const id = (created.body as { board: { id: string } }).board.id;
    await request(app)
      .post(`/boards/${id}/members`)
      .set('Authorization', ownerAuth)
      .send({ email: 'member@test.com', role: 'editor' });

    const res = await request(app)
      .get(`/boards/${id}/members`)
      .set('Authorization', ownerAuth);
    expect(res.status).toBe(200);
    const members = (
      res.body as {
        members: Array<{
          user: { email: string; name: string };
          role: string;
          isOwner: boolean;
        }>;
      }
    ).members;
    expect(members).toHaveLength(2);
    const owner = members.find((m) => m.isOwner);
    const invited = members.find((m) => m.user.email === 'member@test.com');
    expect(owner?.user.email).toBe('owner@test.com');
    expect(invited?.user.name).toBe('Mary Member');
    expect(invited?.role).toBe('editor');
  });

  it('changes a member role (200)', async () => {
    const { auth: ownerAuth } = await auth('owner@test.com');
    const { userId: memberId } = await registerAndLogin('member@test.com');
    const created = await request(app)
      .post('/boards')
      .set('Authorization', ownerAuth)
      .send({ name: 'Role Board' });
    const id = (created.body as { board: { id: string } }).board.id;
    await request(app)
      .post(`/boards/${id}/members`)
      .set('Authorization', ownerAuth)
      .send({ email: 'member@test.com', role: 'viewer' });

    const res = await request(app)
      .patch(`/boards/${id}/members/${memberId}`)
      .set('Authorization', ownerAuth)
      .send({ role: 'editor' });
    expect(res.status).toBe(200);
    const members = (
      res.body as { board: { members: Array<{ user: string; role: string }> } }
    ).board.members;
    expect(members.find((m) => m.user === memberId)?.role).toBe('editor');
  });

  it('removes a member (200)', async () => {
    const { auth: ownerAuth } = await auth('owner@test.com');
    const { userId: memberId } = await registerAndLogin('member@test.com');
    const created = await request(app)
      .post('/boards')
      .set('Authorization', ownerAuth)
      .send({ name: 'Removal Board' });
    const id = (created.body as { board: { id: string } }).board.id;
    await request(app)
      .post(`/boards/${id}/members`)
      .set('Authorization', ownerAuth)
      .send({ email: 'member@test.com', role: 'viewer' });

    const res = await request(app)
      .delete(`/boards/${id}/members/${memberId}`)
      .set('Authorization', ownerAuth);
    expect(res.status).toBe(200);
    const members = (
      res.body as { board: { members: Array<{ user: string }> } }
    ).board.members;
    expect(members.some((m) => m.user === memberId)).toBe(false);
  });

  it('non-owners cannot list members management without access (404)', async () => {
    const { auth: ownerAuth } = await auth('owner@test.com');
    const { auth: otherAuth } = await auth('other@test.com');
    const created = await request(app)
      .post('/boards')
      .set('Authorization', ownerAuth)
      .send({ name: 'Closed Board' });
    const id = (created.body as { board: { id: string } }).board.id;
    const res = await request(app)
      .get(`/boards/${id}/members`)
      .set('Authorization', otherAuth);
    expect(res.status).toBe(404);
  });

  it('deletes a board (204)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const created = await request(app)
      .post('/boards')
      .set('Authorization', bearer)
      .send({ name: 'Bye Board' });
    const id = (created.body as { board: { id: string } }).board.id;
    const res = await request(app)
      .delete(`/boards/${id}`)
      .set('Authorization', bearer);
    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// List routes
// ---------------------------------------------------------------------------

describe('list routes', () => {
  async function makeBoard(bearerAuth: string) {
    const res = await request(app)
      .post('/boards')
      .set('Authorization', bearerAuth)
      .send({ name: 'Test Board' });
    return (res.body as { board: { id: string } }).board.id;
  }

  it('creates a list (201)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const boardId = await makeBoard(bearer);
    const res = await request(app)
      .post(`/boards/${boardId}/lists`)
      .set('Authorization', bearer)
      .send({ title: 'To Do' });
    expect(res.status).toBe(201);
    expect(res.body.list.title).toBe('To Do');
  });

  it('lists the board columns (200)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const boardId = await makeBoard(bearer);
    await request(app)
      .post(`/boards/${boardId}/lists`)
      .set('Authorization', bearer)
      .send({ title: 'To Do' });
    const res = await request(app)
      .get(`/boards/${boardId}/lists`)
      .set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.body.lists).toHaveLength(1);
  });

  it('renames a list (200)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const boardId = await makeBoard(bearer);
    const created = await request(app)
      .post(`/boards/${boardId}/lists`)
      .set('Authorization', bearer)
      .send({ title: 'Old' });
    const listId = (created.body as { list: { id: string } }).list.id;
    const res = await request(app)
      .patch(`/boards/${boardId}/lists/${listId}`)
      .set('Authorization', bearer)
      .send({ title: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.list.title).toBe('New');
  });

  it('deletes a list and cascades its cards (204)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const boardId = await makeBoard(bearer);
    const listRes = await request(app)
      .post(`/boards/${boardId}/lists`)
      .set('Authorization', bearer)
      .send({ title: 'Sprint' });
    const listId = (listRes.body as { list: { id: string } }).list.id;
    await request(app)
      .post(`/boards/${boardId}/cards`)
      .set('Authorization', bearer)
      .send({ listId, title: 'Card 1' });
    const res = await request(app)
      .delete(`/boards/${boardId}/lists/${listId}`)
      .set('Authorization', bearer);
    expect(res.status).toBe(204);
    // Cards under deleted list should be gone.
    const cards = await request(app)
      .get(`/boards/${boardId}/cards`)
      .set('Authorization', bearer);
    expect((cards.body as { cards: unknown[] }).cards).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Card routes
// ---------------------------------------------------------------------------

describe('card routes', () => {
  async function makeBoard(bearerAuth: string) {
    const res = await request(app)
      .post('/boards')
      .set('Authorization', bearerAuth)
      .send({ name: 'Test Board' });
    return (res.body as { board: { id: string } }).board.id;
  }

  async function makeList(bearerAuth: string, boardId: string, title = 'To Do') {
    const res = await request(app)
      .post(`/boards/${boardId}/lists`)
      .set('Authorization', bearerAuth)
      .send({ title });
    return (res.body as { list: { id: string } }).list.id;
  }

  it('creates a card (201)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const boardId = await makeBoard(bearer);
    const listId = await makeList(bearer, boardId);
    const res = await request(app)
      .post(`/boards/${boardId}/cards`)
      .set('Authorization', bearer)
      .send({ listId, title: 'My Card' });
    expect(res.status).toBe(201);
    expect(res.body.card.title).toBe('My Card');
  });

  it('lists all cards on a board (200)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const boardId = await makeBoard(bearer);
    const listId = await makeList(bearer, boardId);
    await request(app)
      .post(`/boards/${boardId}/cards`)
      .set('Authorization', bearer)
      .send({ listId, title: 'Card A' });
    await request(app)
      .post(`/boards/${boardId}/cards`)
      .set('Authorization', bearer)
      .send({ listId, title: 'Card B' });
    const res = await request(app)
      .get(`/boards/${boardId}/cards`)
      .set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect((res.body as { cards: unknown[] }).cards).toHaveLength(2);
  });

  it('reads a single card (200)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const boardId = await makeBoard(bearer);
    const listId = await makeList(bearer, boardId);
    const created = await request(app)
      .post(`/boards/${boardId}/cards`)
      .set('Authorization', bearer)
      .send({ listId, title: 'Read Me' });
    const cardId = (created.body as { card: { id: string } }).card.id;
    const res = await request(app)
      .get(`/boards/${boardId}/cards/${cardId}`)
      .set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.body.card.title).toBe('Read Me');
  });

  it('updates card fields (200)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const boardId = await makeBoard(bearer);
    const listId = await makeList(bearer, boardId);
    const created = await request(app)
      .post(`/boards/${boardId}/cards`)
      .set('Authorization', bearer)
      .send({ listId, title: 'Old' });
    const cardId = (created.body as { card: { id: string } }).card.id;
    const res = await request(app)
      .patch(`/boards/${boardId}/cards/${cardId}`)
      .set('Authorization', bearer)
      .send({ title: 'Updated', labels: ['bug'] });
    expect(res.status).toBe(200);
    expect(res.body.card.title).toBe('Updated');
    expect(res.body.card.labels).toContain('bug');
    expect(res.body.card.version).toBe(1);
  });

  it('moves a card to another list (200)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const boardId = await makeBoard(bearer);
    const listId1 = await makeList(bearer, boardId, 'List 1');
    const listId2 = await makeList(bearer, boardId, 'List 2');
    const created = await request(app)
      .post(`/boards/${boardId}/cards`)
      .set('Authorization', bearer)
      .send({ listId: listId1, title: 'Mover' });
    const cardId = (created.body as { card: { id: string } }).card.id;
    const res = await request(app)
      .patch(`/boards/${boardId}/cards/${cardId}/move`)
      .set('Authorization', bearer)
      .send({ listId: listId2, position: 0 });
    expect(res.status).toBe(200);
    expect(res.body.card.list).toBe(listId2);
  });

  it('deletes a card (204)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const boardId = await makeBoard(bearer);
    const listId = await makeList(bearer, boardId);
    const created = await request(app)
      .post(`/boards/${boardId}/cards`)
      .set('Authorization', bearer)
      .send({ listId, title: 'Gone' });
    const cardId = (created.body as { card: { id: string } }).card.id;
    const res = await request(app)
      .delete(`/boards/${boardId}/cards/${cardId}`)
      .set('Authorization', bearer);
    expect(res.status).toBe(204);
  });

  it('returns the activity log for a card (200)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const boardId = await makeBoard(bearer);
    const listId = await makeList(bearer, boardId);
    const created = await request(app)
      .post(`/boards/${boardId}/cards`)
      .set('Authorization', bearer)
      .send({ listId, title: 'Logged' });
    const cardId = (created.body as { card: { id: string } }).card.id;
    const res = await request(app)
      .get(`/boards/${boardId}/cards/${cardId}/activity`)
      .set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect((res.body as { activities: unknown[] }).activities.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Comment routes
// ---------------------------------------------------------------------------

describe('comment routes', () => {
  async function makeBoard(bearerAuth: string) {
    const res = await request(app)
      .post('/boards')
      .set('Authorization', bearerAuth)
      .send({ name: 'Test Board' });
    return (res.body as { board: { id: string } }).board.id;
  }

  async function makeCard(bearerAuth: string, boardId: string) {
    const listRes = await request(app)
      .post(`/boards/${boardId}/lists`)
      .set('Authorization', bearerAuth)
      .send({ title: 'List' });
    const listId = (listRes.body as { list: { id: string } }).list.id;
    const cardRes = await request(app)
      .post(`/boards/${boardId}/cards`)
      .set('Authorization', bearerAuth)
      .send({ listId, title: 'Card' });
    return (cardRes.body as { card: { id: string } }).card.id;
  }

  it('posts a comment (201)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const boardId = await makeBoard(bearer);
    const cardId = await makeCard(bearer, boardId);
    const res = await request(app)
      .post(`/boards/${boardId}/cards/${cardId}/comments`)
      .set('Authorization', bearer)
      .send({ text: 'Nice card!' });
    expect(res.status).toBe(201);
    expect(res.body.comment.text).toBe('Nice card!');
  });

  it('lists comments on a card (200)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const boardId = await makeBoard(bearer);
    const cardId = await makeCard(bearer, boardId);
    await request(app)
      .post(`/boards/${boardId}/cards/${cardId}/comments`)
      .set('Authorization', bearer)
      .send({ text: 'First!' });
    const res = await request(app)
      .get(`/boards/${boardId}/cards/${cardId}/comments`)
      .set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect((res.body as { comments: unknown[] }).comments).toHaveLength(1);
  });

  it('detects @mention in comment text and stores mention', async () => {
    const { auth: ownerAuth } = await auth('owner@test.com');
    await registerAndLogin('mentioned@test.com');
    const boardId = await makeBoard(ownerAuth);

    // Invite the mentioned user to the board.
    await request(app)
      .post(`/boards/${boardId}/members`)
      .set('Authorization', ownerAuth)
      .send({ email: 'mentioned@test.com', role: 'viewer' });

    const cardId = await makeCard(ownerAuth, boardId);
    const res = await request(app)
      .post(`/boards/${boardId}/cards/${cardId}/comments`)
      .set('Authorization', ownerAuth)
      .send({ text: 'Hey @mentioned@test.com check this out!' });
    expect(res.status).toBe(201);
    expect(
      (res.body.comment as { mentions: string[] }).mentions,
    ).toHaveLength(1);
  });

  it('deletes own comment (204)', async () => {
    const { auth: bearer } = await auth('owner@test.com');
    const boardId = await makeBoard(bearer);
    const cardId = await makeCard(bearer, boardId);
    const created = await request(app)
      .post(`/boards/${boardId}/cards/${cardId}/comments`)
      .set('Authorization', bearer)
      .send({ text: 'Delete me' });
    const commentId = (created.body as { comment: { id: string } }).comment.id;
    const res = await request(app)
      .delete(`/boards/${boardId}/cards/${cardId}/comments/${commentId}`)
      .set('Authorization', bearer);
    expect(res.status).toBe(204);
  });

  it('rejects deleting another member comment unless owner (403)', async () => {
    const { auth: ownerAuth } = await auth('owner@test.com');
    const { auth: editorAuth } = await auth('editor@test.com');
    const boardId = await makeBoard(ownerAuth);

    await request(app)
      .post(`/boards/${boardId}/members`)
      .set('Authorization', ownerAuth)
      .send({ email: 'editor@test.com', role: 'editor' });

    const cardId = await makeCard(ownerAuth, boardId);
    const created = await request(app)
      .post(`/boards/${boardId}/cards/${cardId}/comments`)
      .set('Authorization', ownerAuth)
      .send({ text: 'Owner comment' });
    const commentId = (created.body as { comment: { id: string } }).comment.id;
    const res = await request(app)
      .delete(`/boards/${boardId}/cards/${cardId}/comments/${commentId}`)
      .set('Authorization', editorAuth);
    expect(res.status).toBe(403);
  });
});
