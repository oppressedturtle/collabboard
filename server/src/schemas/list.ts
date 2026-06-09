import { z } from 'zod';

export const createListSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
});

export const updateListSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine(
    (data) => data.title !== undefined || data.position !== undefined,
    { message: 'Provide at least one field to update' },
  );

export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
