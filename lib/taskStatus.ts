/**
 * Task statuses, as stored and as shown.
 *
 * The stored values are untouched -- "pending" is what every existing row
 * carries and what the column defaults to -- but nothing calls it "Pending" any
 * more: a task nobody has started is Backlog. Labels live here alone so the
 * lists, the filters, the dashboards and the reports cannot drift apart.
 */
export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "reopened",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Backlog",
  in_progress: "In Progress",
  completed: "Completed",
  reopened: "Reopened",
};

export const TASK_STATUS_OPTIONS = TASK_STATUSES.map((value) => ({
  value,
  label: TASK_STATUS_LABELS[value],
}));

export function isTaskStatus(value: string | undefined): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

/**
 * Falls back to a humanised form of the stored value, so a status written
 * before this list existed still reads as words rather than "in_progress".
 */
export function formatTaskStatus(value: string) {
  return isTaskStatus(value)
    ? TASK_STATUS_LABELS[value]
    : value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * Reopening is a return trip, not a starting point: only work that was called
 * finished can be sent back. A task that was never completed is moved with the
 * ordinary statuses instead.
 */
export function canReopenFrom(status: string) {
  return status === "completed";
}

/**
 * Whether the task is on a reopened run -- either sitting in Reopened now, or
 * completed again after having been sent back at least once. Time logged here
 * belongs to a reopen cycle and has to carry a note.
 */
export function isOnReopenCycle(reopenCount: number) {
  return reopenCount > 0;
}
