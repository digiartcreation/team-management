/**
 * The date and scope filters the report pages share: the Reports page and the
 * Base Price Report read the same query string the same way.
 */

/** Marks the "no service mapped" choice in the service filter. */
export const UNMAPPED_SERVICE = "__unmapped__";

const displayDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Accepts only the "YYYY-MM-DD" a date input produces. */
export function parseDateInput(raw: string | undefined) {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const date = new Date(`${raw}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function endOfDay(raw: string) {
  return new Date(`${raw}T23:59:59.999Z`);
}

/** Today in the server's local calendar, as the date inputs use it. */
export function todayUtcMidnight() {
  return new Date(`${new Date().toLocaleDateString("en-CA")}T00:00:00.000Z`);
}

/** "1 Oct 2026 – 15 Oct 2026", "From 1 Oct 2026", or "All time". */
export function describeRange(from: Date | null, to: Date | null) {
  if (from && to) {
    return `${displayDate.format(from)} – ${displayDate.format(to)}`;
  }

  if (from) {
    return `From ${displayDate.format(from)}`;
  }

  if (to) {
    return `Up to ${displayDate.format(to)}`;
  }

  return "All time";
}
