import { prisma } from "@/lib/prisma";
import { formatServiceLabel } from "@/lib/services";
import type { TaskClientOption } from "@/components/tasks/ClientWorkField";

/**
 * Clients selectable on the task form: active ones, plus whichever client the
 * task already points at, so editing a task mapped to a since-deactivated
 * client does not silently drop the mapping.
 */
export async function getTaskClientOptions(
  includeClientId?: string | null
): Promise<TaskClientOption[]> {
  const clients = await prisma.client.findMany({
    where: includeClientId
      ? { OR: [{ status: "Active" }, { id: includeClientId }] }
      : { status: "Active" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      serviceMappings: {
        orderBy: { service: "asc" },
        select: { service: true, focus: true },
      },
    },
  });

  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    status: client.status,
    works: client.serviceMappings.map(formatServiceLabel),
  }));
}
