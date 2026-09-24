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
        select: BOARD_CARD_SELECT,
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
    cards: columns[index].map(toBoardCard),
  }));
}

const BOARD_CARD_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  clientWork: true,
  reopenCount: true,
  assignedToId: true,
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
} satisfies Prisma.TaskSelect;

type BoardTask = Prisma.TaskGetPayload<{ select: typeof BOARD_CARD_SELECT }>;

function toBoardCard(task: BoardTask): BoardCard {
  const time = splitReopenMinutes(task.timeLogs);
  // Logs arrive newest first, so the first rework note is the latest word on
  // why the task came back.
  const latestReopenNote =
    task.timeLogs.find((log) => log.reopenCycle > 0 && log.note)?.note ?? null;

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
}

/** One person's board, for the admin dashboard's board-per-member view. */
export type BoardGroup = {
  /** The assignee's id, or "unassigned". */
  key: string;
  /** Null for the Unassigned board. */
  name: string | null;
  /** Every task on this person's board, across all four columns. */
  taskCount: number;
  columns: BoardColumn[];
};

/**
 * Splits the board by assignee: one board per employee, even an empty one so
 * nobody silently drops off the dashboard, plus anyone else who has board
 * tasks (an admin or manager can be assigned work too), and an Unassigned
 * board when anything is waiting on an owner.
 *
 * Everything on the board is fetched in one query and grouped here, rather
 * than five queries per person. Closed work is not on the board, so this is
 * the open and recently finished tasks only.
 */
export async function loadTaskBoardsByAssignee(): Promise<BoardGroup[]> {
  const [members, tasks] = await Promise.all([
    prisma.user.findMany({
      where: { role: "member" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: { status: { in: [...BOARD_COLUMNS] } },
      orderBy: { updatedAt: "desc" },
      select: BOARD_CARD_SELECT,
    }),
  ]);

  const people = new Map(members.map((member) => [member.id, member.name]));
  const tasksByKey = new Map<string, BoardTask[]>();

  for (const task of tasks) {
    const key = task.assignedToId ?? "unassigned";

    if (task.assignedToId && !people.has(task.assignedToId)) {
      people.set(task.assignedToId, task.assignedTo?.name ?? "Unknown");
    }

    const bucket = tasksByKey.get(key);

    if (bucket) {
      bucket.push(task);
    } else {
      tasksByKey.set(key, [task]);
    }
  }

  const groups: BoardGroup[] = [...people.entries()]
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([id, name]) => toBoardGroup(id, name, tasksByKey.get(id) ?? []));

  const unassigned = tasksByKey.get("unassigned");

  if (unassigned) {
    groups.push(toBoardGroup("unassigned", null, unassigned));
  }

  return groups;
}

function toBoardGroup(
  key: string,
  name: string | null,
  tasks: BoardTask[]
): BoardGroup {
  return {
    key,
    name,
    taskCount: tasks.length,
    columns: BOARD_COLUMNS.map((status) => {
      const inColumn = tasks.filter((task) => task.status === status);

      return {
        status,
        label: formatTaskStatus(status),
        total: inColumn.length,
        cards: inColumn.slice(0, COLUMN_CARD_LIMIT).map(toBoardCard),
      };
    }),
  };
}
