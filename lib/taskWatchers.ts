import { prisma } from "@/lib/prisma";
import { formatRole } from "@/lib/roles";

/**
 * Everyone who can be added as a watcher: every user, from every team and in
 * every role, admins included.
 */
export async function getWatcherOptions() {
  const people = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });

  // One person can hold an account per role; name the role only where that
  // would otherwise list the same name twice.
  const seen = new Map<string, number>();

  for (const person of people) {
    seen.set(person.name, (seen.get(person.name) ?? 0) + 1);
  }

  return people.map((person) => ({
    id: person.id,
    name:
      (seen.get(person.name) ?? 0) > 1
        ? `${person.name} (${formatRole(person.role)})`
        : person.name,
  }));
}
