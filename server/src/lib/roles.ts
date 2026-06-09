export const BOARD_ROLES = ['viewer', 'editor', 'owner'] as const;
export type BoardRole = (typeof BOARD_ROLES)[number];

// Higher rank ⇒ more privileges. owner ⊇ editor ⊇ viewer.
const RANK: Record<BoardRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

/** True when `role` satisfies (is at least) the `minimum` required role. */
export function hasMinRole(role: BoardRole, minimum: BoardRole): boolean {
  return RANK[role] >= RANK[minimum];
}
