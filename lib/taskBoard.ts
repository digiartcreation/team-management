import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { splitReopenMinutes } from "@/lib/duration";
import { formatTaskStatus } from "@/lib/taskStatus";

/**
 * The board's columns, in the order work moves through them. Reopened sits
 * before Completed rather than after it: a task that came back is waiting on
 * someone again, and belongs next to the other open work, not filed with the
 * finished.
 */
export const BOARD_COLUMNS = [
  "pending",
  "in_progress",
  "reopened",
  "completed",
] as const;

export type BoardStatus = (typeof BOARD_COLUMNS)[number];

/**
 * How many cards a column shows. The header still counts every task, so a
 * capped column reads as "25 of 60 shown" rather than quietly lying; the rest
 * are a click away on the Tasks page.
 */
const COLUMN_CARD_LIMIT = 25;

export type BoardCard = {
  id: string;
  title: string;
  priority: string;
  clientName: string | null;
  clientWork: string | null;
  assigneeName: string | null;
  /** Everything logged against the task, rework included. */
  minutes: number;
  /** The share of that spent after a reopen. */
  reopenMinutes: number;
  reopenCount: number;
  /** The most recent note written against a reopen cycle, if any. */
  latestReopenNote: string | null;
};

export type BoardColumn = {
  status: BoardStatus;
  label: string;
  /** Every task in this column, not just the ones with a card. */
  total: number;
  cards: BoardCard[];
};

/**
 * Loads the dashboard board for whichever slice of tasks the caller owns --
 * everything for an admin, one team for a manager, one person for an employee.
 * The counts come from a single grouped query so the column headers stay true
 * even where the cards below them are capped.
 */
export async function loadTaskBoard(
  where: Prisma.TaskWhereInput
): Promise<BoardColumn[]> {
  const [counts, ...columns] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    ...BOARD_COLUMNS.map((status) =>
      prisma.task.findMany({
        where: { ...where, status },
        // Most recently touched first, so a column opens on what moved last.
        orderBy: { updatedAt: "desc" },
        take: COLUMN_CARD_LIMIT,
        select: {
          id: true,
          title: true,
          priority: true,
          clientWork: true,
          reopenCount: true,
          client: { select: { name: true } },
          assignedTo: { select: { name: true } },
          timeLogs: {
            select: {
              minutes: true,
              reopenCycle: true,
              note: true,
              date: true,
            },
            orderBy: { date: "desc" },
          },
        },
      })
    ),
  ]);

  const totals = new Map(
    counts.map((row) => [row.status, row._count._all] as const)
  );

  return BOARD_COLUMNS.map((status, index) => ({
    status,
    label: formatTaskStatus(status),
    total: totals.get(status) ?? 0,
    cards: columns[index].map((task) => {
      const time = splitReopenMinutes(task.timeLogs);
      // Logs arrive newest first, so the first rework note is the latest word
      // on why the task came back.
      const latestReopenNote =
        task.timeLogs.find((log) => log.reopenCycle > 0 && log.note)?.note ??
        null;

      return {
        id: task.id,
        title: task.title,
        priority: task.priority,
        clientName: task.client?.name ?? null,
        clientWork: task.clientWork,
        assigneeName: task.assignedTo?.name ?? null,
        minutes: time.total,
        reopenMinutes: time.reopen,
        reopenCount: task.reopenCount,
        latestReopenNote,
      };
    }),
  }));
}
