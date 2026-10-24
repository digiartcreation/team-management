import { prisma } from "@/lib/prisma";
import { ADMIN_ROLES, formatRole } from "@/lib/roles";

/**
 * Everyone who can be added as a watcher: employees and managers from every
 * team. Admins are left out -- they see and can log time on every task
 * already. Anyone in `keepIds` stays listed whatever their role, so re-saving a
 * task never quietly drops a watcher it already has.
 */
export async function getWatcherOptions(keepIds: string[] = []) {
  const people = await prisma.user.findMany({
    where:
      keepIds.length > 0
        ? { OR: [{ role: { notIn: ADMIN_ROLES } }, { id: { in: keepIds } }] }
        : { role: { notIn: ADMIN_ROLES } },
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
