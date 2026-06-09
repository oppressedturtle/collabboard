import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

const objectId = z
  .string()
  .refine((v) => isValidObjectId(v), { message: 'Invalid id' });

export const createCardSchema = z.object({
  listId: objectId,
  title: z.string().trim().min(1, 'Title is required').max(280),
  description: z.string().max(5000).optional(),
});

export const updateCardSchema = z
  .object({
    title: z.string().trim().min(1).max(280).optional(),
    description: z.string().max(5000).optional(),
    labels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    assignees: z.array(objectId).max(50).optional(),
    dueDate: z.string().datetime().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const moveCardSchema = z.object({
  listId: objectId,
  position: z.number().int().min(0),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
