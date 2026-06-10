import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { isValidObjectId } from 'mongoose';

import { changedCardFields, recordActivity } from '../lib/activity.js';
import { emitToBoard } from '../lib/socket.js';
import { requireBoardRole } from '../middleware/boardAccess.js';
import { HttpError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { ActivityModel } from '../models/Activity.js';
import { CardModel } from '../models/Card.js';
import { ListModel } from '../models/List.js';
import {
  createCardSchema,
  moveCardSchema,
  updateCardSchema,
  type CreateCardInput,
  type MoveCardInput,
  type UpdateCardInput,
} from '../schemas/card.js';

// Mounted at `/boards/:id/cards` (mergeParams exposes the board `:id`).
export const cardsRouter = Router({ mergeParams: true });

function cardIdParam(req: Request): string {
  const { cardId } = req.params;
  if (!cardId || !isValidObjectId(cardId)) {
    throw new HttpError(400, 'Invalid card id');
  }
  return cardId;
}

/** All cards on the board (client groups them by list). (viewer+) */
cardsRouter.get(
  '/',
  requireBoardRole('viewer'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cards = await CardModel.find({ board: req.board?.id })
        .sort({ position: 1, createdAt: 1 })
        .exec();
      res.json({ cards: cards.map((c) => c.toJSON()) });
    } catch (err) {
      next(err);
    }
  },
);

/** Create a card at the end of a list. (editor+) */
cardsRouter.post(
  '/',
  requireBoardRole('editor'),
  validateBody(createCardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const boardId = req.board?.id;
      const { listId, title, description } = req.body as CreateCardInput;

      // The list must belong to this board.
      const listOk = await ListModel.exists({ _id: listId, board: boardId });
      if (!listOk) throw new HttpError(404, 'List not found on this board');

      const count = await CardModel.countDocuments({ list: listId });
      const card = await CardModel.create({
        board: boardId,
        list: listId,
        title,
        description: description ?? '',
        position: count,
      });
      await recordActivity({
        board: String(boardId),
        card: card.id,
        actor: String(req.user?.id),
        type: 'created',
      });
      const actorId = String(req.user?.id);
      emitToBoard(String(boardId), 'card:created', {
        card: card.toJSON(),
        boardId: String(boardId),
        actorId,
      });
      res.status(201).json({ card: card.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

/** Read a single card. (viewer+) */
cardsRouter.get(
  '/:cardId',
  requireBoardRole('viewer'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const card = await CardModel.findOne({
        _id: cardIdParam(req),
        board: req.board?.id,
      });
      if (!card) throw new HttpError(404, 'Card not found');
      res.json({ card: card.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

/** Update card fields. (editor+) */
cardsRouter.patch(
  '/:cardId',
  requireBoardRole('editor'),
  validateBody(updateCardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const card = await CardModel.findOne({
        _id: cardIdParam(req),
        board: req.board?.id,
      });
      if (!card) throw new HttpError(404, 'Card not found');

      const body = req.body as UpdateCardInput;
      if (body.title !== undefined) card.title = body.title;
      if (body.description !== undefined) card.description = body.description;
      if (body.labels !== undefined) card.labels = body.labels;
      if (body.assignees !== undefined) {
        card.set('assignees', body.assignees);
      }
      if (body.dueDate !== undefined) {
        card.dueDate = body.dueDate === null ? null : new Date(body.dueDate);
      }
      card.set('version', ((card.get('version') as number) ?? 0) + 1);
      await card.save();
      const fields = changedCardFields(body);
      if (fields.length > 0) {
        await recordActivity({
          board: String(req.board?.id),
          card: card.id,
          actor: String(req.user?.id),
          type: 'updated',
          meta: { fields },
        });
      }
      const actorId = String(req.user?.id);
      emitToBoard(String(req.board?.id), 'card:updated', {
        card: card.toJSON(),
        boardId: String(req.board?.id),
        actorId,
      });
      res.json({ card: card.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

/** Move a card to another list/position. (editor+) */
cardsRouter.patch(
  '/:cardId/move',
  requireBoardRole('editor'),
  validateBody(moveCardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const boardId = req.board?.id;
      const { listId, position } = req.body as MoveCardInput;

      const listOk = await ListModel.exists({ _id: listId, board: boardId });
      if (!listOk) throw new HttpError(404, 'Target list not found on this board');

      const card = await CardModel.findOne({
        _id: cardIdParam(req),
        board: boardId,
      });
      if (!card) throw new HttpError(404, 'Card not found');

      const movedLists = String(card.list) !== String(listId);
      card.set('list', listId);
      card.position = position;
      card.set('version', ((card.get('version') as number) ?? 0) + 1);
      await card.save();
      // Only log cross-list moves; pure reorders within a list are noise.
      if (movedLists) {
        await recordActivity({
          board: String(boardId),
          card: card.id,
          actor: String(req.user?.id),
          type: 'moved',
        });
      }
      const actorId = String(req.user?.id);
      emitToBoard(String(boardId), 'card:moved', {
        card: card.toJSON(),
        boardId: String(boardId),
        actorId,
      });
      res.json({ card: card.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

/** Delete a card. (editor+) */
cardsRouter.delete(
  '/:cardId',
  requireBoardRole('editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cardId = cardIdParam(req);
      const result = await CardModel.deleteOne({
        _id: cardId,
        board: req.board?.id,
      });
      if (result.deletedCount === 0) {
        throw new HttpError(404, 'Card not found');
      }
      // Cascade: the card's activity log goes with it.
      await ActivityModel.deleteMany({ card: cardId, board: req.board?.id });
      const boardId = String(req.board?.id);
      emitToBoard(boardId, 'card:deleted', {
        cardId,
        boardId,
        actorId: String(req.user?.id),
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

/** A card's activity log, newest first. (viewer+) */
cardsRouter.get(
  '/:cardId/activity',
  requireBoardRole('viewer'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cardId = cardIdParam(req);
      // Ensure the card belongs to this board before exposing its log.
      const exists = await CardModel.exists({
        _id: cardId,
        board: req.board?.id,
      });
      if (!exists) throw new HttpError(404, 'Card not found');

      const activities = await ActivityModel.find({
        card: cardId,
        board: req.board?.id,
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('actor', 'name email')
        .exec();
      res.json({ activities: activities.map((a) => a.toJSON()) });
    } catch (err) {
      next(err);
    }
  },
);
