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
    }
  }
}

export {};
