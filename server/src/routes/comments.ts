import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { rateLimit } from 'express-rate-limit';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

import { isTest } from '../config/env.js';
import { sendMentionNotification } from '../lib/mail.js';
import { emitToBoard } from '../lib/socket.js';
import { requireBoardRole } from '../middleware/boardAccess.js';
import { HttpError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { BoardModel } from '../models/Board.js';
import { CardModel } from '../models/Card.js';
import { CommentModel } from '../models/Comment.js';
import { UserModel } from '../models/User.js';

export const commentsRouter = Router({ mergeParams: true });

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id ?? (req.ip ?? 'unknown'),
  skip: () => isTest,
  message: { error: 'Too many comments, please slow down.' },
});

const createCommentSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

/** List comments on a card, oldest-first. (viewer+) */
commentsRouter.get(
  '/',
  requireBoardRole('viewer'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardId } = req.params;
      if (!cardId || !isValidObjectId(cardId)) {
        throw new HttpError(400, 'Invalid card id');
      }
      const exists = await CardModel.exists({
        _id: cardId,
        board: req.board?.id,
      });
      if (!exists) throw new HttpError(404, 'Card not found');

      const comments = await CommentModel.find({ card: cardId })
        .sort({ createdAt: 1 })
        .limit(200)
        .populate('author', 'name email')
        .exec();
      res.json({ comments: comments.map((c) => c.toJSON()) });
    } catch (err) {
      next(err);
    }
  },
);

/** Post a comment. (viewer+ — anyone with access can comment) */
commentsRouter.post(
  '/',
  commentLimiter,
  requireBoardRole('viewer'),
  validateBody(createCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardId } = req.params;
      if (!cardId || !isValidObjectId(cardId)) {
        throw new HttpError(400, 'Invalid card id');
      }

      const board = req.board;
      if (!board) throw new HttpError(404, 'Board not found');

      const card = await CardModel.findOne({
        _id: cardId,
        board: board.id,
      }).lean();
      if (!card) throw new HttpError(404, 'Card not found');

      const { text } = req.body as z.infer<typeof createCommentSchema>;

      // Detect @email mentions in the comment text, limited to board members.
      const emailRe = /@([\w.+%-]+@[\w.-]+\.[a-z]{2,})/gi;
      const extractedEmails: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = emailRe.exec(text)) !== null) {
        if (m[1]) extractedEmails.push(m[1].toLowerCase());
      }

      const mentionedUsers: Array<{ _id: unknown; name: string; email: string }> =
        [];
      if (extractedEmails.length > 0) {
        const memberIds = board.members.map((m) => m.user);
        const users = await UserModel.find({
          email: { $in: extractedEmails },
          _id: { $in: memberIds },
        })
          .select('name email')
          .lean();
        mentionedUsers.push(...users);
      }

      const comment = await CommentModel.create({
        board: board.id,
        card: cardId,
        author: req.user?.id,
        text,
        mentions: mentionedUsers.map((u) => u._id),
      });

      await comment.populate('author', 'name email');
      const commentJson = comment.toJSON();

      const boardId = String(board.id);
      emitToBoard(boardId, 'comment:created', {
        comment: commentJson,
        boardId,
        cardId,
        actorId: String(req.user?.id),
      });

      // Fire-and-forget mention emails.
      if (mentionedUsers.length > 0) {
        const boardData = await BoardModel.findById(boardId)
          .populate('owner', 'name')
          .lean();
        const mentionerName =
          (commentJson.author as { name?: string } | null)?.name ?? 'Someone';
        for (const u of mentionedUsers) {
          void sendMentionNotification({
            toEmail: u.email,
            toName: u.name,
            mentionerName,
            boardName: boardData?.name ?? 'a board',
            cardTitle: card.title,
            commentText: text,
          });
        }
      }

      res.status(201).json({ comment: commentJson });
    } catch (err) {
      next(err);
    }
  },
);

/** Delete a comment (author or board owner). */
commentsRouter.delete(
  '/:commentId',
  requireBoardRole('viewer'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { commentId } = req.params;
      if (!commentId || !isValidObjectId(commentId)) {
        throw new HttpError(400, 'Invalid comment id');
      }

      const comment = await CommentModel.findOne({
        _id: commentId,
        board: req.board?.id,
      });
      if (!comment) throw new HttpError(404, 'Comment not found');

      const userId = String(req.user?.id);
      const isAuthor = String(comment.author) === userId;
      const isBoardOwner = String(req.board?.owner) === userId;
      if (!isAuthor && !isBoardOwner) {
        throw new HttpError(403, 'Cannot delete another member\'s comment');
      }

      await comment.deleteOne();

      const boardId = String(req.board?.id);
      emitToBoard(boardId, 'comment:deleted', {
        commentId,
        boardId,
        cardId: String(comment.card),
        actorId: userId,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
