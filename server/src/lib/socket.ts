import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { isValidObjectId } from 'mongoose';

import { env } from '../config/env.js';
import { BoardModel } from '../models/Board.js';
import { ACCESS_COOKIE } from './cookies.js';
import { logger } from './logger.js';
import { verifyAccessToken } from './tokens.js';

interface PresenceEntry {
  userId: string;
  email: string;
}

// boardId → Map<socketId, PresenceEntry>
const presence = new Map<string, Map<string, PresenceEntry>>();

function parseCookieValue(header: string, name: string): string | undefined {
  const match = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function getPresenceList(boardId: string): PresenceEntry[] {
  const room = presence.get(boardId);
  if (!room) return [];
  return Array.from(room.values());
}

let _io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  _io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  // JWT auth: read from httpOnly cookie sent with the WS upgrade, or auth.token.
  _io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie ?? '';
      const fromCookie = parseCookieValue(cookieHeader, ACCESS_COOKIE);
      const token =
        fromCookie ??
        (socket.handshake.auth as { token?: string } | undefined)?.token;
      if (!token) throw new Error('No token');
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.email = payload.email;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  _io.on('connection', (socket: Socket) => {
    const userId = String(socket.data.userId);
    const email = String(socket.data.email);
    logger.debug({ socketId: socket.id, userId }, 'socket connected');

    socket.on('board:join', async (boardId: string) => {
      try {
        if (!boardId || !isValidObjectId(boardId)) return;
        // Verify membership before allowing room entry.
        const board = await BoardModel.findById(boardId).lean();
        if (!board) return;
        const isMember = board.members.some((m) => String(m.user) === userId);
        if (!isMember) return;

        await socket.join(`board:${boardId}`);

        if (!presence.has(boardId)) presence.set(boardId, new Map());
        presence.get(boardId)!.set(socket.id, { userId, email });

        _io!.to(`board:${boardId}`).emit('presence:update', {
          boardId,
          viewers: getPresenceList(boardId),
        });
      } catch (err) {
        logger.error({ err }, 'board:join error');
      }
    });

    socket.on('board:leave', (boardId: string) => {
      void socket.leave(`board:${boardId}`);
      cleanPresence(boardId, socket.id);
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id, userId }, 'socket disconnected');
      for (const boardId of presence.keys()) {
        cleanPresence(boardId, socket.id);
      }
    });
  });

  return _io;
}

function cleanPresence(boardId: string, socketId: string): void {
  const room = presence.get(boardId);
  if (!room || !room.has(socketId)) return;
  room.delete(socketId);
  if (room.size === 0) {
    presence.delete(boardId);
  } else {
    _io!.to(`board:${boardId}`).emit('presence:update', {
      boardId,
      viewers: getPresenceList(boardId),
    });
  }
}

/** Broadcast a board-scoped event to every socket in the board room. */
export function emitToBoard(
  boardId: string,
  event: string,
  data: Record<string, unknown>,
): void {
  _io?.to(`board:${boardId}`).emit(event, data);
}
