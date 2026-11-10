import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { FILTER_TAGS } from "@/lib/filterOptions";

/**
 * Everyone who can be picked as a client's Owner or Communication Person, by
 * name, since that is what the client keeps. One person can hold more than
 * one account (one per role), hence the de-duplication.
 *
 * Cached: the employee actions clear FILTER_TAGS.people whenever someone is
 * added, edited or removed (lib/filterOptions.ts), so a new name shows at once.
 */
export const getClientPeopleOptions = unstable_cache(
  async () => {
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { name: true },
    });

    return [...new Set(users.map((user) => user.name))];
  },
  ["client-people-options"],
  { tags: [FILTER_TAGS.people], revalidate: 300 }
);
