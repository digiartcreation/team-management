import type { Prisma } from "@prisma/client";

/**
 * An inactive employee's work is hidden, not deleted: their attendance, tasks,
 * time, updates, learnings, tools, research, activity and feedback drop out of
 * every list, board and report, and all of it shows again the moment they are
 * made active. Only the Employees page still lists them, so they can be made
 * active again.
 */
export const ACTIVE_USER = { isActive: true } as const;

/** For records with a `user` relation: only those of active people. */
export const OWNED_BY_ACTIVE_USER = { user: ACTIVE_USER } as const;

/** Tasks still on show: unassigned, or assigned to someone active. */
export const VISIBLE_TASK: Prisma.TaskWhereInput = {
  OR: [{ assignedToId: null }, { assignedTo: ACTIVE_USER }],
};

/** `where`, narrowed to the tasks still on show. */
export function visibleTasks(where: Prisma.TaskWhereInput = {}): Prisma.TaskWhereInput {
  return { AND: [where, VISIBLE_TASK] };
}
