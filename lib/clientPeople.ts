import { prisma } from "@/lib/prisma";

/**
 * Everyone who can be picked as a client's Owner or Communication Person, by
 * name, since that is what the client keeps. One person can hold more than
 * one account (one per role), hence the de-duplication.
 */
export async function getClientPeopleOptions() {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return [...new Set(users.map((user) => user.name))];
}
