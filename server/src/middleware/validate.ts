import { type NextFunction, type Request, type Response } from 'express';
import { type ZodSchema } from 'zod';

/**
 * Validate and coerce `req.body` against a Zod schema. On success the parsed
 * (typed) data replaces `req.body`; on failure a 400 with field-level issues
 * is returned and the handler chain stops.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
