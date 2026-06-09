import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { isValidObjectId } from 'mongoose';

import { requireAuth } from '../middleware/auth.js';
import { requireBoardRole } from '../middleware/boardAccess.js';
import { HttpError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { BoardModel } from '../models/Board.js';
import { CardModel } from '../models/Card.js';
import { ListModel } from '../models/List.js';
import { UserModel } from '../models/User.js';
import {
  addMemberSchema,
  createBoardSchema,
  updateBoardSchema,
  updateMemberRoleSchema,
  type AddMemberInput,
  type CreateBoardInput,
  type UpdateBoardInput,
} from '../schemas/board.js';
import { cardsRouter } from './cards.js';
import { listsRouter } from './lists.js';

export const boardsRouter = Router();

// Every board route requires authentication.
boardsRouter.use(requireAuth);

// Board-scoped columns + cards (each route authorizes via requireBoardRole).
boardsRouter.use('/:id/lists', listsRouter);
boardsRouter.use('/:id/cards', cardsRouter);

/** List boards the current user is a member of. */
boardsRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const boards = await BoardModel.find({ 'members.user': req.user?.id })
        .sort({ updatedAt: -1 })
        .exec();
      res.json({ boards: boards.map((b) => b.toJSON()) });
    } catch (err) {
      next(err);
    }
  },
);

/** Create a board; the creator becomes its owner. */
boardsRouter.post(
  '/',
  validateBody(createBoardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const { name, description } = req.body as CreateBoardInput;
      const board = await BoardModel.create({
        name,
        description: description ?? '',
        owner: userId,
        members: [{ user: userId, role: 'owner' }],
      });
      res.status(201).json({ board: board.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

/** Read a single board (any member). */
boardsRouter.get(
  '/:id',
  requireBoardRole('viewer'),
  (req: Request, res: Response) => {
    res.json({ board: req.board?.toJSON() });
  },
);

/** Update board name/description (editor+). */
boardsRouter.patch(
  '/:id',
  requireBoardRole('editor'),
  validateBody(updateBoardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const board = req.board;
      if (!board) throw new HttpError(404, 'Board not found');
      const { name, description } = req.body as UpdateBoardInput;
      if (name !== undefined) board.name = name;
      if (description !== undefined) board.description = description;
      await board.save();
      res.json({ board: board.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

/** Delete a board (owner only). */
boardsRouter.delete(
  '/:id',
  requireBoardRole('owner'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const boardId = req.board?.id;
      // Cascade: remove the board's cards and lists, then the board itself.
      await CardModel.deleteMany({ board: boardId });
      await ListModel.deleteMany({ board: boardId });
      await req.board?.deleteOne();
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

/** Invite a member by email (owner only). */
boardsRouter.post(
  '/:id/members',
  requireBoardRole('owner'),
  validateBody(addMemberSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const board = req.board;
      if (!board) throw new HttpError(404, 'Board not found');
      const { email, role } = req.body as AddMemberInput;

      const user = await UserModel.findOne({ email }).lean();
      if (!user) throw new HttpError(404, 'No user with that email');

      const alreadyMember = board.members.some(
        (m) => String(m.user) === String(user._id),
      );
      if (alreadyMember) {
        throw new HttpError(409, 'User is already a member');
      }

      board.members.push({ user: user._id, role });
      await board.save();
      res.status(201).json({ board: board.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

/** Change a member's role (owner only; cannot change the owner). */
boardsRouter.patch(
  '/:id/members/:userId',
  requireBoardRole('owner'),
  validateBody(updateMemberRoleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const board = req.board;
      if (!board) throw new HttpError(404, 'Board not found');
      const { userId } = req.params;
      if (!userId || !isValidObjectId(userId)) {
        throw new HttpError(400, 'Invalid user id');
      }
      if (String(board.owner) === userId) {
        throw new HttpError(400, "The owner's role cannot be changed");
      }

      const member = board.members.find((m) => String(m.user) === userId);
      if (!member) throw new HttpError(404, 'Member not found');

      member.role = (req.body as { role: 'editor' | 'viewer' }).role;
      await board.save();
      res.json({ board: board.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

/** Remove a member (owner only; cannot remove the owner). */
boardsRouter.delete(
  '/:id/members/:userId',
  requireBoardRole('owner'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const board = req.board;
      if (!board) throw new HttpError(404, 'Board not found');
      const { userId } = req.params;
      if (!userId || !isValidObjectId(userId)) {
        throw new HttpError(400, 'Invalid user id');
      }
      if (String(board.owner) === userId) {
        throw new HttpError(400, 'The owner cannot be removed');
      }

      const index = board.members.findIndex(
        (m) => String(m.user) === userId,
      );
      if (index === -1) {
        throw new HttpError(404, 'Member not found');
      }
      board.members.splice(index, 1);

      await board.save();
      res.json({ board: board.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);
