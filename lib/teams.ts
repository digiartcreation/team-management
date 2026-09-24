import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Team membership, now that one person can sit on several teams.
 *
 * Everything that used to ask "is this on my team?" asks "is this on any of my
 * teams?" instead. A task still belongs to exactly one team; only people are
 * many-to-many.
 */

/**
 * Stands in for "no teams" inside an `in` filter. An empty `in: []` would
 * match nothing too, but spelling it out keeps the intent readable where a
 * manager with no team must see nothing rather than everything.
 */
const NO_TEAM = "__no_team__";

/** Every team the user belongs to, by name. */
export async function getUserTeams(userId: string | undefined) {
  if (!userId) {
    return [];
  }

  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    orderBy: { team: { name: "asc" } },
    select: { team: { select: { id: true, name: true } } },
  });

  return memberships.map((membership) => membership.team);
}

export async function getUserTeamIds(userId: string | undefined) {
  return (await getUserTeams(userId)).map((team) => team.id);
}

/** The ids to filter by, never empty: no teams means match nothing. */
export function scopeIds(teamIds: string[]) {
  return teamIds.length > 0 ? teamIds : [NO_TEAM];
}

/** Users on any of these teams. */
export function usersOnTeams(teamIds: string[]): Prisma.UserWhereInput {
  return { teamMemberships: { some: { teamId: { in: scopeIds(teamIds) } } } };
}

/** Tasks owned by any of these teams. */
export function tasksOnTeams(teamIds: string[]): Prisma.TaskWhereInput {
  return { teamId: { in: scopeIds(teamIds) } };
}

export async function isOnTeam(userId: string, teamId: string) {
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { userId: true },
  });

  return Boolean(membership);
}

/** Whether the two people share at least one team. */
export async function shareATeam(userId: string, otherUserId: string) {
  const teamIds = await getUserTeamIds(userId);

  if (teamIds.length === 0) {
    return false;
  }

  const shared = await prisma.teamMember.findFirst({
    where: { userId: otherUserId, teamId: { in: teamIds } },
    select: { userId: true },
  });

  return Boolean(shared);
}
