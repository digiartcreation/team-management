import { prisma } from "@/lib/prisma";
import { getViewerAccount } from "@/lib/viewer";

export type ModuleKey = "tasks" | "updates" | "learnings" | "tools";

export type ModuleAlertCounts = Partial<Record<ModuleKey, number>>;

const modules: ModuleKey[] = ["tasks", "updates", "learnings", "tools"];

/**
 * `reviewing` is the module whose list page is being rendered. It is marked
 * as reviewed here and its badge shows 0, rather than the page asking the
 * server to mark it once loaded, which rendered the whole page a second time.
 */
export async function getSidebarAlertCounts(
  userId?: string,
  role?: string,
  reviewing?: ModuleKey
): Promise<ModuleAlertCounts> {
  if (!userId || (role !== "admin" && role !== "manager")) {
    return {};
  }

  const [currentUser, reviews] = await Promise.all([
    role === "manager" ? getViewerAccount(userId) : null,
    prisma.moduleReview.findMany({
      where: { userId, module: { in: modules } },
    }),
    reviewing
      ? prisma.moduleReview.upsert({
          where: { userId_module: { userId, module: reviewing } },
          update: { reviewedAt: new Date() },
          create: { userId, module: reviewing },
        })
      : null,
  ]);
  const managerTeamId = role === "manager" ? currentUser?.teamId ?? "__no_team__" : undefined;
  const reviewedAt = new Map(reviews.map((review) => [review.module, review.reviewedAt]));
  const after = (module: ModuleKey) => ({
    gt: reviewedAt.get(module) ?? new Date(0),
  });

  const [tasks, updates, learnings, tools] = await Promise.all([
    reviewing === "tasks"
      ? 0
      : prisma.task.count({
          where: {
            updatedAt: after("tasks"),
            ...(managerTeamId ? { teamId: managerTeamId } : {}),
          },
        }),
    reviewing === "updates"
      ? 0
      : prisma.dailyUpdate.count({
          where: {
            updatedAt: after("updates"),
            ...(managerTeamId ? { user: { teamId: managerTeamId } } : {}),
          },
        }),
    reviewing === "learnings"
      ? 0
      : prisma.learning.count({
          where: {
            updatedAt: after("learnings"),
            ...(managerTeamId ? { user: { teamId: managerTeamId } } : {}),
          },
        }),
    reviewing === "tools"
      ? 0
      : prisma.toolUsage.count({
          where: {
            updatedAt: after("tools"),
            ...(managerTeamId ? { user: { teamId: managerTeamId } } : {}),
          },
        }),
  ]);

  return { tasks, updates, learnings, tools };
}
