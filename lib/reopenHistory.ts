/**
 * The story of a task's returns, assembled from the two places it is recorded:
 * the TaskReopen row saying why it was sent back, and the time logs written
 * while that cycle was open, each carrying the note the log form insists on.
 *
 * Built from both rather than either, because each can exist without the other
 * -- a task reopened this morning has a reason and no hours yet, and a status
 * edited from the task form leaves hours with no reason.
 */

export type ReopenEntry = {
  id: string;
  minutes: number;
  date: Date;
  note: string | null;
  userName: string | null;
};

export type ReopenCycleHistory = {
  cycle: number;
  /** Why the task was sent back, where whoever reopened it said so. */
  reason: string | null;
  reopenedBy: string | null;
  reopenedAt: Date | null;
  /** Hours logged against this cycle. */
  minutes: number;
  entries: ReopenEntry[];
};

type ReopenRow = {
  cycle: number;
  reason: string | null;
  createdAt: Date;
  user: { name: string } | null;
};

type LogRow = {
  id: string;
  minutes: number;
  date: Date;
  note: string | null;
  reopenCycle: number;
  user?: { name: string } | null;
};

export function buildReopenHistory(
  reopens: ReopenRow[],
  logs: LogRow[]
): ReopenCycleHistory[] {
  const cycles = new Map<number, ReopenCycleHistory>();

  function cycleFor(cycle: number) {
    let existing = cycles.get(cycle);

    if (!existing) {
      existing = {
        cycle,
        reason: null,
        reopenedBy: null,
        reopenedAt: null,
        minutes: 0,
        entries: [],
      };
      cycles.set(cycle, existing);
    }

    return existing;
  }

  for (const reopen of reopens) {
    const entry = cycleFor(reopen.cycle);
    entry.reason = reopen.reason;
    entry.reopenedBy = reopen.user?.name ?? null;
    entry.reopenedAt = reopen.createdAt;
  }

  for (const log of logs) {
    if (log.reopenCycle === 0) {
      continue;
    }

    const entry = cycleFor(log.reopenCycle);
    entry.minutes += log.minutes;
    entry.entries.push({
      id: log.id,
      minutes: log.minutes,
      date: log.date,
      note: log.note,
      userName: log.user?.name ?? null,
    });
  }

  return [...cycles.values()]
    .map((cycle) => ({
      ...cycle,
      // Oldest work first, so a cycle reads in the order it happened.
      entries: cycle.entries.sort((a, b) => a.date.getTime() - b.date.getTime()),
    }))
    .sort((a, b) => a.cycle - b.cycle);
}

/** How many notes there are to read, for the disclosure label. */
export function countReopenNotes(history: ReopenCycleHistory[]) {
  return history.reduce(
    (sum, cycle) =>
      sum + (cycle.reason ? 1 : 0) + cycle.entries.filter((e) => e.note).length,
    0
  );
}
