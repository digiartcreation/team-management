import { prisma } from "@/lib/prisma";
import { splitReopenMinutes, summariseByUser } from "@/lib/duration";
import { formatOfficeDate } from "@/lib/officeTime";
import { buildReopenHistory } from "@/lib/reopenHistory";
import { formatInr } from "@/lib/services";
import { taskDescriptionHtml } from "@/lib/taskDescription";
import { formatReopenCause, formatTaskStatus } from "@/lib/taskStatus";

/** Everything the task details dialog shows, ready to render. */
export type TaskDetails = {
  id: string;
  title: string;
  /** Sanitised HTML, or null when the task has no description. */
  descriptionHtml: string | null;
  status: string;
  statusLabel: string;
  priority: string;
  reopenCount: number;
  assignee: string | null;
  team: string | null;
  client: string | null;
  clientWork: string | null;
  /** "Weightage 2", "5 posters", "₹50,000": what the work counts as. */
  workDetail: string | null;
  watchers: string[];
  createdOn: string;
  editedOn: string | null;
  completedOn: string | null;
  /** Minutes: all of it, the first run, and any rework after reopening. */
  time: {
    total: number;
    original: number;
    reopen: number;
    byPerson: { name: string; minutes: number }[];
  };
  logs: {
    id: string;
    date: string;
    minutes: number;
    person: string | null;
    note: string | null;
    /** 0 for the first run, then the reopen it was logged against. */
    cycle: number;
  }[];
  reopens: {
    cycle: number;
    cause: string | null;
    reason: string | null;
    by: string | null;
    on: string | null;
  }[];
  /** Where to edit it, when the viewer may. */
  editHref: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/**
 * One task's details for `viewer`, or null when it does not exist or is not
 * theirs to see. Seen by admins, its assignee, its watchers and its team --
 * the same people who may log time on it.
 */
export async function loadTaskDetails(
  viewer: { id: string; role?: string },
  taskId: string
): Promise<TaskDetails | null> {
  const [task, user] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: { select: { name: true } },
        team: { select: { name: true } },
        client: { select: { name: true } },
        watchers: {
          orderBy: { createdAt: "asc" },
          select: { userId: true, user: { select: { name: true } } },
        },
        timeLogs: {
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            minutes: true,
            date: true,
            note: true,
            reopenCycle: true,
            user: { select: { name: true } },
          },
        },
        reopens: {
          select: {
            cycle: true,
            reason: true,
            cause: true,
            createdAt: true,
            user: { select: { name: true } },
          },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: viewer.id }, select: { teamId: true } }),
  ]);

  if (!task) {
    return null;
  }

  const isAdmin = viewer.role === "admin";
  const isAssignee = task.assignedToId === viewer.id;
  const sameTeam = Boolean(user?.teamId) && user?.teamId === task.teamId;
  const isWatcher = task.watchers.some((watcher) => watcher.userId === viewer.id);

  if (!isAdmin && !isAssignee && !isWatcher && !sameTeam) {
    return null;
  }

  // As on the edit page: admins anything, managers their team's, employees
  // their own.
  const canEdit = isAdmin || (viewer.role === "manager" ? sameTeam : isAssignee);
  const time = splitReopenMinutes(task.timeLogs);

  return {
    id: task.id,
    title: task.title,
    descriptionHtml: taskDescriptionHtml(task.description),
    status: task.status,
    statusLabel: formatTaskStatus(task.status),
    priority: task.priority,
    reopenCount: task.reopenCount,
    assignee: task.assignedTo?.name ?? null,
    team: task.team?.name ?? null,
    client: task.client?.name ?? null,
    clientWork: task.clientWork,
    workDetail:
      task.videoWeightage !== null
        ? `Weightage ${Number(task.videoWeightage)}`
        : task.posterCount !== null
          ? `${task.posterCount} ${task.posterCount === 1 ? "poster" : "posters"}`
          : task.digitalMarketingAmount !== null
            ? formatInr(Number(task.digitalMarketingAmount))
            : null,
    watchers: task.watchers.map((watcher) => watcher.user.name),
    createdOn: dateFormatter.format(task.createdAt),
    editedOn:
      task.updatedAt.getTime() !== task.createdAt.getTime()
        ? dateFormatter.format(task.updatedAt)
        : null,
    completedOn: task.completedAt ? formatOfficeDate(task.completedAt) : null,
    time: {
      total: time.total,
      original: time.original,
      reopen: time.reopen,
      byPerson: summariseByUser(task.timeLogs),
    },
    logs: task.timeLogs.map((log) => ({
      id: log.id,
      date: dateFormatter.format(log.date),
      minutes: log.minutes,
      person: log.user?.name ?? null,
      note: log.note,
      cycle: log.reopenCycle,
    })),
    reopens: buildReopenHistory(task.reopens, task.timeLogs).map((cycle) => ({
      cycle: cycle.cycle,
      cause: formatReopenCause(cycle.cause) || null,
      reason: cycle.reason,
      by: cycle.reopenedBy,
      on: cycle.reopenedAt ? dateFormatter.format(cycle.reopenedAt) : null,
    })),
    editHref: canEdit ? `/tasks/${task.id}/edit` : null,
  };
}
