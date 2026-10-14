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

/** A shift time as minutes since midnight: "18:00" is 1080. */
export function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * The instant the office clock reads `minutes` past midnight on a stored day
 * (that day's UTC midnight): 18:00 on Oct 14 is 12:30 UTC that day.
 */
export function officeInstant(day: Date, minutes: number) {
  const wall = day.getTime() + minutes * 60_000;
  const parts = officeParts(new Date(wall));
  const offset =
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) -
    wall;
  return new Date(wall - offset);
}
