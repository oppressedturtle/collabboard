import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { isValidObjectId } from 'mongoose';

import { requireBoardRole } from '../middleware/boardAccess.js';
import { HttpError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { ActivityModel } from '../models/Activity.js';
import { CardModel } from '../models/Card.js';
import { ListModel } from '../models/List.js';
import {
  createListSchema,
  updateListSchema,
  type CreateListInput,
  type UpdateListInput,
} from '../schemas/list.js';

// mergeParams so the parent `:id` (board id) is visible here. Mounted at
// `/boards/:id/lists`.
export const listsRouter = Router({ mergeParams: true });

/** List a board's columns, ordered. (viewer+) */
listsRouter.get(
  '/',
  requireBoardRole('viewer'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lists = await ListModel.find({ board: req.board?.id })
        .sort({ position: 1, createdAt: 1 })
        .exec();
      res.json({ lists: lists.map((l) => l.toJSON()) });
    } catch (err) {
      next(err);
    }
  },
);

/** Create a column at the end. (editor+) */
listsRouter.post(
  '/',
  requireBoardRole('editor'),
  validateBody(createListSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const boardId = req.board?.id;
      const { title } = req.body as CreateListInput;
      // Append after the current last column.
      const count = await ListModel.countDocuments({ board: boardId });
      const list = await ListModel.create({
        board: boardId,
        title,
        position: count,
      });
      res.status(201).json({ list: list.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

/** Rename or reposition a column. (editor+) */
listsRouter.patch(
  '/:listId',
  requireBoardRole('editor'),
  validateBody(updateListSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { listId } = req.params;
      if (!listId || !isValidObjectId(listId)) {
        throw new HttpError(400, 'Invalid list id');
      }
      const list = await ListModel.findOne({
        _id: listId,
        board: req.board?.id,
      });
      if (!list) throw new HttpError(404, 'List not found');

      const { title, position } = req.body as UpdateListInput;
      if (title !== undefined) list.title = title;
      if (position !== undefined) list.position = position;
      await list.save();
      res.json({ list: list.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

/** Delete a column. (editor+) */
listsRouter.delete(
  '/:listId',
  requireBoardRole('editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { listId } = req.params;
      if (!listId || !isValidObjectId(listId)) {
        throw new HttpError(400, 'Invalid list id');
      }
      const result = await ListModel.deleteOne({
        _id: listId,
        board: req.board?.id,
      });
      if (result.deletedCount === 0) {
        throw new HttpError(404, 'List not found');
      }
      // Cascade: remove the column's cards and their activity logs.
      const cards = await CardModel.find({
        list: listId,
        board: req.board?.id,
      })
        .select('_id')
        .lean();
      const cardIds = cards.map((c) => c._id);
      if (cardIds.length > 0) {
        await ActivityModel.deleteMany({ card: { $in: cardIds } });
      }
      await CardModel.deleteMany({ list: listId, board: req.board?.id });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
