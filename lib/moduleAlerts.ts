import { prisma } from "@/lib/prisma";

export type ModuleKey = "tasks" | "updates" | "learnings" | "tools";

export type ModuleAlertCounts = Partial<Record<ModuleKey, number>>;

const modules: ModuleKey[] = ["tasks", "updates", "learnings", "tools"];

export async function getSidebarAlertCounts(
  userId?: string,
  role?: string
): Promise<ModuleAlertCounts> {
  if (!userId || (role !== "admin" && role !== "manager")) {
    return {};
  }

  const currentUser =
    role === "manager"
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { teamId: true },
        })
      : null;
  const managerTeamId = role === "manager" ? currentUser?.teamId ?? "__no_team__" : undefined;

  const reviews = await prisma.moduleReview.findMany({
    where: { userId, module: { in: modules } },
  });
  const reviewedAt = new Map(reviews.map((review) => [review.module, review.reviewedAt]));
  const after = (module: ModuleKey) => ({
    gt: reviewedAt.get(module) ?? new Date(0),
  });

  const [tasks, updates, learnings, tools] = await Promise.all([
    prisma.task.count({
      where: {
        updatedAt: after("tasks"),
        ...(managerTeamId ? { teamId: managerTeamId } : {}),
      },
    }),
    prisma.dailyUpdate.count({
      where: {
        updatedAt: after("updates"),
        ...(managerTeamId ? { user: { teamId: managerTeamId } } : {}),
      },
    }),
    prisma.learning.count({
      where: {
        updatedAt: after("learnings"),
        ...(managerTeamId ? { user: { teamId: managerTeamId } } : {}),
      },
    }),
    prisma.toolUsage.count({
      where: {
        updatedAt: after("tools"),
        ...(managerTeamId ? { user: { teamId: managerTeamId } } : {}),
      },
    }),
  ]);

  return { tasks, updates, learnings, tools };
}
