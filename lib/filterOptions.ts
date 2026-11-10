import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ACTIVE_USER } from "@/lib/activeUsers";

/**
 * The lists behind the Tasks, Reports and Base Price Report filters, which
 * every one of those pages read again although they rarely change. They are
 * cached, and each is cleared the moment it can change, by the server actions
 * that change it (revalidateTag), so a filter never offers a stale choice:
 *
 * - services: tasks created, edited or deleted (app/tasks/actions.ts)
 * - clients: clients added, renamed or removed (app/clients/actions.ts)
 * - people: employees added, edited, removed or (in)activated
 *   (app/employees/actions.ts)
 * - teams: teams added, renamed or removed (app/teams/actions.ts)
 *
 * The 5-minute expiry is a safety net for changes made outside the app (in
 * phpMyAdmin, say), which no action clears. The cache stores JSON, so these
 * hold strings only.
 */
export const FILTER_TAGS = {
  services: "filter-services",
  clients: "filter-clients",
  people: "filter-people",
  teams: "filter-teams",
} as const;

const SAFETY_NET_SECONDS = 5 * 60;

/**
 * Every service a task has been mapped to, exactly as stored and A to Z, e.g.
 * "Digital Marketing (SEO)". Finding them reads the whole task table.
 */
export const getMappedWork = unstable_cache(
  async () => {
    const rows = await prisma.task.findMany({
      where: { clientWork: { not: null } },
      select: { clientWork: true },
      distinct: ["clientWork"],
      orderBy: { clientWork: "asc" },
    });

    return rows
      .map((row) => row.clientWork)
      .filter((work): work is string => Boolean(work));
  },
  ["filter-mapped-work"],
  { tags: [FILTER_TAGS.services], revalidate: SAFETY_NET_SECONDS }
);

/** Every client, active or not, so older work stays filterable. A to Z. */
export const getClientOptions = unstable_cache(
  () =>
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ["filter-clients"],
  { tags: [FILTER_TAGS.clients], revalidate: SAFETY_NET_SECONDS }
);

/** Active employees only (see lib/activeUsers.ts), A to Z. */
export const getActivePeopleOptions = unstable_cache(
  () =>
    prisma.user.findMany({
      where: ACTIVE_USER,
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ["filter-active-people"],
  { tags: [FILTER_TAGS.people], revalidate: SAFETY_NET_SECONDS }
);

/** Every team, A to Z. */
export const getTeamOptions = unstable_cache(
  () =>
    prisma.team.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ["filter-teams"],
  { tags: [FILTER_TAGS.teams], revalidate: SAFETY_NET_SECONDS }
);
