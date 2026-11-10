import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { OWNED_BY_ACTIVE_USER } from "@/lib/activeUsers";
import { buildBasePriceReport } from "@/lib/basePriceReport";
import { toServiceMapping } from "@/lib/clientServices";

function decimal(value: { toString(): string } | null) {
  return value === null ? null : Number(value.toString());
}

/** A date in no month a report can show: where the rest of a task's history is filed. */
const OUTSIDE_THE_REPORT = new Date(0);

type HistoryRow = { taskId: string; date: Date; _sum: { minutes: number | null } };

/**
 * The minutes the amounts are shared over (buildBasePriceReport's pools):
 * every task's all-time total, every client and service's all-time total, and
 * each client and service's total for each month the report's logs fall in.
 *
 * Reading every log the clients ever had, day by day, gave all three but grew
 * with history. With a bounded range, the months it touches are read by day
 * and the rest of each task's history comes as one row dated outside them:
 * the task and service totals are the same, and so is every month a report
 * can look up. Without both ends of the range, the full history is read.
 */
async function loadHistory(
  taskIds: string[],
  range?: { from: Date | null; to: Date | null }
): Promise<HistoryRow[]> {
  if (taskIds.length === 0) {
    return [];
  }

  if (!range?.from || !range.to) {
    const everyDay = await prisma.taskTimeLog.groupBy({
      by: ["taskId", "date"],
      where: { taskId: { in: taskIds } },
      _sum: { minutes: true },
    });
    return everyDay;
  }

  // Whole calendar months, as monthKeyOf files a log: its date's UTC month.
  const start = new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(range.to.getUTCFullYear(), range.to.getUTCMonth() + 1, 1));

  const [totals, inMonths] = await Promise.all([
    prisma.taskTimeLog.groupBy({
      by: ["taskId"],
      where: { taskId: { in: taskIds } },
      _sum: { minutes: true },
    }),
    prisma.taskTimeLog.groupBy({
      by: ["taskId", "date"],
      where: { taskId: { in: taskIds }, date: { gte: start, lt: end } },
      _sum: { minutes: true },
    }),
  ]);

  const inMonthsByTask = new Map<string, number>();

  for (const row of inMonths) {
    inMonthsByTask.set(row.taskId, (inMonthsByTask.get(row.taskId) ?? 0) + (row._sum.minutes ?? 0));
  }

  const rest: HistoryRow[] = totals.flatMap((row) => {
    const minutes = (row._sum.minutes ?? 0) - (inMonthsByTask.get(row.taskId) ?? 0);
    return minutes !== 0
      ? [{ taskId: row.taskId, date: OUTSIDE_THE_REPORT, _sum: { minutes } }]
      : [];
  });

  return [...inMonths, ...rest];
}

/**
 * Loads and prices the time logs matching `where`. Shared by the Base Price
 * Report and Services Count, so both give a client the same income, cost and
 * profit for the same range.
 */
export async function loadBasePriceReport(
  where: Prisma.TaskTimeLogWhereInput,
  /** The report's first and last day, when both are set. */
  range?: { from: Date | null; to: Date | null }
) {
  const logs = await prisma.taskTimeLog.findMany({
    // Time logged by an inactive employee is left out until they are made
    // active again.
    where: { AND: [where, OWNED_BY_ACTIVE_USER] },
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
  const dailyMinutes = await loadHistory(
    clientTasks.map((task) => task.id),
    range
  );
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
