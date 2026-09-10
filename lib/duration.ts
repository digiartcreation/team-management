/** A log entry cannot be longer than a full day's work. */
export const MAX_LOG_MINUTES = 24 * 60;

/**
 * Renders whole minutes as "7h 30m", dropping the empty half: "2h", "45m".
 * Zero is spelled out rather than shown as "0m", since it reads as "nothing
 * logged yet" in the task list.
 */
export function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "0m";
  }

  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const mins = whole % 60;

  if (hours === 0) {
    return `${mins}m`;
  }

  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

/**
 * Combines the hours and minutes inputs from the log-time form into whole
 * minutes. Both arrive as strings and either may be blank, but not both.
 */
export function parseDurationInput(hoursRaw: string, minutesRaw: string) {
  const hours = hoursRaw ? Number(hoursRaw) : 0;
  const mins = minutesRaw ? Number(minutesRaw) : 0;

  if (!Number.isFinite(hours) || !Number.isFinite(mins)) {
    throw new Error("Enter time spent as numbers.");
  }

  if (!Number.isInteger(hours) || !Number.isInteger(mins)) {
    throw new Error("Enter whole hours and minutes.");
  }

  if (hours < 0 || mins < 0) {
    throw new Error("Time spent cannot be negative.");
  }

  if (mins > 59) {
    throw new Error("Minutes must be between 0 and 59.");
  }

  const total = hours * 60 + mins;

  if (total <= 0) {
    throw new Error("Enter how much time was spent.");
  }

  if (total > MAX_LOG_MINUTES) {
    throw new Error("A single entry cannot exceed 24 hours.");
  }

  return total;
}

/** Sums per-person subtotals, largest first, for the task list breakdown. */
export function summariseByUser(
  logs: { minutes: number; user: { name: string } }[]
) {
  const totals = new Map<string, number>();

  for (const log of logs) {
    totals.set(log.user.name, (totals.get(log.user.name) ?? 0) + log.minutes);
  }

  return [...totals.entries()]
    .map(([name, minutes]) => ({ name, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
}

export function totalMinutes(logs: { minutes: number }[]) {
  return logs.reduce((sum, log) => sum + log.minutes, 0);
}
