import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatRole } from "@/lib/roles";
import { FILTER_TAGS } from "@/lib/filterOptions";

/**
 * Cached per set of kept ids: the employee actions clear FILTER_TAGS.people
 * whenever someone is added, edited, made (in)active or removed
 * (lib/filterOptions.ts), so the list never lags behind.
 */
const loadWatcherOptions = unstable_cache(
  async (keepIds: string[]) => {
    const people = await prisma.user.findMany({
      where: { OR: [{ isActive: true }, { id: { in: keepIds } }] },
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
  },
  ["watcher-options"],
  { tags: [FILTER_TAGS.people], revalidate: 300 }
);

/**
 * Everyone who can be added as a watcher: every active user, from every team
 * and in every role, admins included. `keepIds` -- the watchers a task
 * already has -- stay listed even when inactive, so saving it does not drop
 * them.
 */
export function getWatcherOptions(keepIds: string[] = []) {
  return loadWatcherOptions([...keepIds].sort());
}
