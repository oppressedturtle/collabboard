import 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by `requireAuth` after a valid access token is verified. */
      user?: {
        id: string;
        email: string;
      };
      /** Populated by `requireBoardRole` after loading + authorizing a board. */
      board?: import('../models/Board.js').BoardDocument;
      /** The authenticated user's role on `board`. */
      boardRole?: import('../lib/roles.js').BoardRole;
    }
  }
}

export {};
