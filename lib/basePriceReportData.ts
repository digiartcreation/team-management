import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildBasePriceReport } from "@/lib/basePriceReport";
import { toServiceMapping } from "@/lib/clientServices";

function decimal(value: { toString(): string } | null) {
  return value === null ? null : Number(value.toString());
}

/**
 * Loads and prices the time logs matching `where`. Shared by the Base Price
 * Report and Services Count, so both give a client the same income, cost and
 * profit for the same range.
 */
export async function loadBasePriceReport(where: Prisma.TaskTimeLogWhereInput) {
  const logs = await prisma.taskTimeLog.findMany({
    where,
    select: {
      minutes: true,
      date: true,
      user: { select: { id: true, name: true, sector: true, designation: true } },
      task: {
        select: {
          id: true,
          title: true,
          clientWork: true,
          videoWeightage: true,
          posterCount: true,
          digitalMarketingAmount: true,
          client: { select: { id: true, name: true } },
        },
      },
    },
  });

  const clientIds = [
    ...new Set(logs.flatMap((log) => (log.task.client ? [log.task.client.id] : []))),
  ];

  // A package or a per-count task pays for every hour logged on it, inside the
  // filters or not, so its share needs the clients' full history by day.
  const [mappingRows, basePriceRows, clientTasks] = await Promise.all([
    prisma.clientService.findMany({
      where: { clientId: { in: clientIds } },
      select: {
        clientId: true,
        service: true,
        focus: true,
        paymentType: true,
        percentage: true,
        packageAmount: true,
        perUnitAmount: true,
        billingCycle: true,
      },
    }),
    prisma.basePrice.findMany({
      select: { service: true, sector: true, designation: true, basePrice: true },
    }),
    prisma.task.findMany({
      where: { clientId: { in: clientIds } },
      select: { id: true, clientId: true, clientWork: true },
    }),
  ]);
  const dailyMinutes =
    clientTasks.length > 0
      ? await prisma.taskTimeLog.groupBy({
          by: ["taskId", "date"],
          where: { taskId: { in: clientTasks.map((task) => task.id) } },
          _sum: { minutes: true },
        })
      : [];
  const tasksById = new Map(clientTasks.map((task) => [task.id, task]));

  return buildBasePriceReport({
    logs: logs.map((log) => ({
      minutes: log.minutes,
      date: log.date,
      user: log.user,
      task: {
        ...log.task,
        videoWeightage: decimal(log.task.videoWeightage),
        digitalMarketingAmount: decimal(log.task.digitalMarketingAmount),
      },
    })),
    mappings: mappingRows.map((row) => ({
      clientId: row.clientId,
      ...toServiceMapping(row),
    })),
    basePrices: basePriceRows.map((row) => ({
      ...row,
      basePrice: row.basePrice.toNumber(),
    })),
    history: dailyMinutes.map((row) => ({
      taskId: row.taskId,
      clientId: tasksById.get(row.taskId)?.clientId ?? null,
      clientWork: tasksById.get(row.taskId)?.clientWork ?? null,
      date: row.date,
      minutes: row._sum.minutes ?? 0,
    })),
  });
}
