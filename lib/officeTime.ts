/**
 * The office's wall clock. The server runs on UTC, but shifts, lateness and
 * which day a check-in belongs to are all about the time in the office, so
 * attendance reads every timestamp through this zone rather than the server's.
 */
export const OFFICE_TIME_ZONE = "Asia/Kolkata";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: OFFICE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function officeParts(value: Date) {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(value).map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** The office calendar day `value` falls on, stored as that day's UTC midnight. */
export function officeDate(value: Date) {
  const { year, month, day } = officeParts(value);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Minutes since midnight on the office clock: 09:30 there is 570. */
export function officeMinutes(value: Date) {
  const { hour, minute } = officeParts(value);
  return hour * 60 + minute;
}
