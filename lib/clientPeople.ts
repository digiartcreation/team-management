import { prisma } from "@/lib/prisma";

/**
 * Names offered while typing a client's Owner or Communication Person. Only a
 * suggestion: the fields stay free text, so someone outside the team can be
 * named too. One person can hold more than one account (one per role), hence
 * the de-duplication.
 */
export async function getClientPeopleSuggestions() {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return [...new Set(users.map((user) => user.name))];
}
