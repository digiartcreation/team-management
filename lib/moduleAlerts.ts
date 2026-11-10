import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getViewerAccount } from "@/lib/viewer";

export type ModuleKey = "tasks" | "updates" | "learnings" | "tools";

export type ModuleAlertCounts = Partial<Record<ModuleKey, number>>;

/** The table each module's badge counts, and how its rows reach a person. */
const OWNED_TABLES = {
  updates: Prisma.raw("`DailyUpdate`"),
  learnings: Prisma.raw("`Learning`"),
  tools: Prisma.raw("`ToolUsage`"),
} as const;

/**
 * `reviewing` is the module whose list page is being rendered. It is marked
 * as reviewed here and its badge shows 0, rather than the page asking the
 * server to mark it once loaded, which rendered the whole page a second time.
 *
 * Each badge counts the rows changed since the person last opened that module
 * (all of them if never), leaving out an inactive employee's work (see
 * lib/activeUsers.ts) and, for a manager, anything outside their team. The four
 * counts, and the "last opened" times they compare against, are read in one SQL
 * statement rather than five queries, on every page an admin or manager opens.
 */
export async function getSidebarAlertCounts(
  userId?: string,
  role?: string,
  reviewing?: ModuleKey
): Promise<ModuleAlertCounts> {
  if (!userId || (role !== "admin" && role !== "manager")) {
    return {};
  }

  const currentUser = role === "manager" ? await getViewerAccount(userId) : null;
  const managerTeamId = role === "manager" ? currentUser?.teamId ?? "__no_team__" : undefined;

  // When the person last opened `module`; the start of time if never.
  const since = (module: ModuleKey) => Prisma.sql`COALESCE(
    (SELECT r.reviewedAt FROM \`ModuleReview\` r WHERE r.userId = ${userId} AND r.module = ${module}),
    TIMESTAMP('1970-01-01 00:00:00')
  )`;

  // Unassigned tasks count, and those of active people; for a manager, their
  // team's tasks only.
  const tasksSince = Prisma.sql`(
    SELECT COUNT(*) FROM \`Task\` t
    LEFT JOIN \`User\` a ON a.id = t.assignedToId
    WHERE t.updatedAt > ${since("tasks")}
      AND (t.assignedToId IS NULL OR a.isActive = TRUE)
      ${managerTeamId ? Prisma.sql`AND t.teamId = ${managerTeamId}` : Prisma.empty}
  )`;

  // An active person's entries; for a manager, their team's people only.
  const ownedSince = (module: keyof typeof OWNED_TABLES) => Prisma.sql`(
    SELECT COUNT(*) FROM ${OWNED_TABLES[module]} x
    JOIN \`User\` o ON o.id = x.userId
    WHERE x.updatedAt > ${since(module)}
      AND o.isActive = TRUE
      ${managerTeamId ? Prisma.sql`AND o.teamId = ${managerTeamId}` : Prisma.empty}
  )`;

  const count = (module: ModuleKey, query: Prisma.Sql) =>
    reviewing === module ? Prisma.sql`0` : query;

  const [, rows] = await Promise.all([
    reviewing
      ? prisma.moduleReview.upsert({
          where: { userId_module: { userId, module: reviewing } },
          update: { reviewedAt: new Date() },
          create: { userId, module: reviewing },
        })
      : null,
    prisma.$queryRaw<Record<ModuleKey, bigint | number>[]>`
      SELECT
        ${count("tasks", tasksSince)} AS tasks,
        ${count("updates", ownedSince("updates"))} AS updates,
        ${count("learnings", ownedSince("learnings"))} AS learnings,
        ${count("tools", ownedSince("tools"))} AS tools
    `,
  ]);
  const row = rows[0];

  return {
    tasks: Number(row?.tasks ?? 0),
    updates: Number(row?.updates ?? 0),
    learnings: Number(row?.learnings ?? 0),
    tools: Number(row?.tools ?? 0),
  };
}
