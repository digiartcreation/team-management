import { prisma } from "@/lib/prisma";
import { getUserTeamIds, tasksOnTeams, usersOnTeams } from "@/lib/teams";

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

  // Undefined for an admin, who is not scoped; a manager counts any of their teams.
  const managerTeamIds =
    role === "manager" ? await getUserTeamIds(userId) : undefined;

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
        ...(managerTeamIds ? tasksOnTeams(managerTeamIds) : {}),
      },
    }),
    prisma.dailyUpdate.count({
      where: {
        updatedAt: after("updates"),
        ...(managerTeamIds ? { user: usersOnTeams(managerTeamIds) } : {}),
      },
    }),
    prisma.learning.count({
      where: {
        updatedAt: after("learnings"),
        ...(managerTeamIds ? { user: usersOnTeams(managerTeamIds) } : {}),
      },
    }),
    prisma.toolUsage.count({
      where: {
        updatedAt: after("tools"),
        ...(managerTeamIds ? { user: usersOnTeams(managerTeamIds) } : {}),
      },
    }),
  ]);

  return { tasks, updates, learnings, tools };
}
