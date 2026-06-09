import { type NextFunction, type Request, type Response } from 'express';
import { isValidObjectId } from 'mongoose';

import { hasMinRole, type BoardRole } from '../lib/roles.js';
import { BoardModel } from '../models/Board.js';
import { HttpError } from './error.js';

/**
 * Load the board referenced by `:id` and authorize the current user against a
 * minimum role. Populates `req.board` and `req.boardRole` on success.
 *
 * Non-members receive 404 (not 403) so board existence isn't leaked.
 */
export function requireBoardRole(minimum: BoardRole) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new HttpError(401, 'Authentication required');
      }

      const { id } = req.params;
      if (!id || !isValidObjectId(id)) {
        throw new HttpError(400, 'Invalid board id');
      }

      const board = await BoardModel.findById(id);
      if (!board) {
        throw new HttpError(404, 'Board not found');
      }

      const membership = board.members.find(
        (m) => String(m.user) === userId,
      );
      if (!membership) {
        // Hide existence from non-members.
        throw new HttpError(404, 'Board not found');
      }
      if (!hasMinRole(membership.role, minimum)) {
        throw new HttpError(403, 'Insufficient permissions');
      }

      req.board = board;
      req.boardRole = membership.role;
      next();
    } catch (err) {
      next(err);
    }
  };
}
