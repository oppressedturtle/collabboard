import { z } from 'zod';

export const createBoardSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(2000).optional(),
});

export const updateBoardSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'Provide at least one field to update',
  });

// New members may only be added as editor/viewer; ownership is not transferable
// through this endpoint.
export const addMemberSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(['editor', 'viewer']).default('viewer'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['editor', 'viewer']),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
