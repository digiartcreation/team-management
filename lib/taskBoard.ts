import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ACTIVE_USER, visibleTasks } from "@/lib/activeUsers";
import { splitReopenMinutes } from "@/lib/duration";
import { COMPLETED_STALE_DAYS, formatTaskStatus } from "@/lib/taskStatus";

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
  /** When the task was first completed (locked after that), as an ISO string. */
  completedAt: string | null;
  /**
   * Still sitting in Completed more than COMPLETED_STALE_DAYS (lib/taskStatus)
   * after it was first completed: due to be closed, so the card is outlined
   * in red.
   */
  completedStale: boolean;
  /** Every entry logged against the task, newest first. */
  timeLogs: BoardTimeLog[];
};

export type BoardTimeLog = {
  minutes: number;
  /** The day the work was done, as "YYYY-MM-DD". */
  date: string;
  userName: string;
  note: string | null;
};

export type BoardColumn = {
  status: BoardStatus;
  label: string;
  /** Every task in this column, not just the ones with a card. */
  total: number;
  cards: BoardCard[];
};

/**
 * Every task in one column of a board, not just the ones with a card: the
 * dashboards' stat cards read these rather than counting the same tasks again.
 */
export function columnTotal(columns: BoardColumn[], status: BoardStatus) {
  return columns.find((column) => column.status === status)?.total ?? 0;
}

/**
 * Loads the dashboard board for whichever slice of tasks the caller owns --
 * everything for an admin, one team for a manager, one person for an employee.
 *
 * Two queries, whatever the number of columns: the first lists every task on
 * the board (id and status only), which gives each column's count -- true even
 * where its cards are capped -- and picks the cards it shows; the second loads
 * just those cards. Loading each column on its own took four queries, plus
 * four more per column for its client, assignee and time logs.
 */
export async function loadTaskBoard(
  where: Prisma.TaskWhereInput
): Promise<BoardColumn[]> {
  const onBoard = await prisma.task.findMany({
    where: visibleTasks({ ...where, status: { in: [...BOARD_COLUMNS] } }),
    // Most recently touched first, so a column opens on what moved last.
    orderBy: { updatedAt: "desc" },
    select: { id: true, status: true },
  });

  const columnIds = new Map<string, string[]>(BOARD_COLUMNS.map((status) => [status, []]));
  const totals = new Map<string, number>();

  for (const task of onBoard) {
    totals.set(task.status, (totals.get(task.status) ?? 0) + 1);
    const ids = columnIds.get(task.status);

    if (ids && ids.length < COLUMN_CARD_LIMIT) {
      ids.push(task.id);
    }
  }

  const shownIds = [...columnIds.values()].flat();
  const cards =
    shownIds.length > 0
      ? await prisma.task.findMany({
          where: { id: { in: shownIds } },
          select: BOARD_CARD_SELECT,
        })
      : [];
  const cardsById = new Map(cards.map((card) => [card.id, card]));

  return BOARD_COLUMNS.map((status) => ({
    status,
    label: formatTaskStatus(status),
    total: totals.get(status) ?? 0,
    // In the first query's order; a task deleted in between is left out.
    cards: (columnIds.get(status) ?? []).flatMap((id) => {
      const card = cardsById.get(id);
      return card ? [toBoardCard(card)] : [];
    }),
  }));
}

const BOARD_CARD_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  clientWork: true,
  reopenCount: true,
  completedAt: true,
  assignedToId: true,
  client: { select: { name: true } },
  assignedTo: { select: { name: true } },
  timeLogs: {
    select: {
      minutes: true,
      reopenCycle: true,
      note: true,
      date: true,
      user: { select: { name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  },
} satisfies Prisma.TaskSelect;

type BoardTask = Prisma.TaskGetPayload<{ select: typeof BOARD_CARD_SELECT }>;

const COMPLETED_STALE_MS = COMPLETED_STALE_DAYS * 24 * 60 * 60 * 1000;

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
    completedAt: task.completedAt?.toISOString() ?? null,
    // Worked out here, on the server, so the page and the browser agree.
    completedStale:
      task.status === "completed" &&
      task.completedAt !== null &&
      Date.now() - task.completedAt.getTime() > COMPLETED_STALE_MS,
    timeLogs: task.timeLogs.map((log) => ({
      minutes: log.minutes,
      // Log dates are stored as their UTC midnight.
      date: log.date.toISOString().slice(0, 10),
      userName: log.user.name,
      note: log.note,
    })),
  };
}

/**
 * The tasks a person has been added to as a watcher, for the Watching board on
 * their dashboard: the same columns as their own board. Closed tasks are left
 * out, as on every board; time cannot be logged on them, and logging time is
 * what the board is for.
 */
export function loadWatchedBoard(userId: string) {
  return loadTaskBoard({ watchers: { some: { userId } } });
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
      where: { role: "member", ...ACTIVE_USER },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: visibleTasks({ status: { in: [...BOARD_COLUMNS] } }),
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
