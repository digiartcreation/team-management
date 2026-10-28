import { officeDate } from "@/lib/officeTime";

/**
 * What an entry on the calendar is. "Other" covers anything that is
 * not one of the rest: a deadline, a note to self.
 */
export const CALENDAR_EVENT_TYPES = [
  { value: "meeting", label: "Meeting" },
  { value: "client_meeting", label: "Client Meeting" },
  { value: "training", label: "Training Session" },
  { value: "event", label: "Event" },
  { value: "reminder", label: "Reminder" },
  { value: "other", label: "Other" },
] as const;

export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number]["value"];

export const DEFAULT_CALENDAR_EVENT_TYPE: CalendarEventType = "meeting";

/**
 * Who sees an entry. Private is the default, so nothing someone jots down for
 * themselves lands on everyone's calendar by accident. "Selected" is its author
 * plus the people picked for it (CalendarEventShare).
 */
export const CALENDAR_VISIBILITIES = [
  { value: "private", label: "Only me" },
  { value: "selected", label: "Selected people" },
  { value: "everyone", label: "Everyone" },
] as const;

export type CalendarVisibility =
  (typeof CALENDAR_VISIBILITIES)[number]["value"];

export const DEFAULT_CALENDAR_VISIBILITY: CalendarVisibility = "private";

/**
 * How an entry repeats from its date: a weekly meeting shows on the same
 * weekday every week, a monthly one on the same day every month -- or on the
 * month's last day when it is shorter (the 31st falls on the 30th in June).
 */
export const CALENDAR_RECURRENCES = [
  { value: "none", label: "Does not repeat" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
] as const;

export type CalendarRecurrence =
  (typeof CALENDAR_RECURRENCES)[number]["value"];

export function isCalendarRecurrence(
  value: string
): value is CalendarRecurrence {
  return CALENDAR_RECURRENCES.some((recurrence) => recurrence.value === value);
}

export function isCalendarEventType(value: string): value is CalendarEventType {
  return CALENDAR_EVENT_TYPES.some((type) => type.value === value);
}

export function isCalendarVisibility(
  value: string
): value is CalendarVisibility {
  return CALENDAR_VISIBILITIES.some((visibility) => visibility.value === value);
}

export function calendarEventTypeLabel(value: string) {
  return (
    CALENDAR_EVENT_TYPES.find((type) => type.value === value)?.label ?? "Other"
  );
}

/**
 * An entry as the calendar receives it: one per day it shows on, so a weekly
 * entry arrives once for each of its weeks on the grid, all with the same id.
 */
export type CalendarEntry = {
  id: string;
  title: string;
  type: string;
  /** "YYYY-MM-DD": the day this one shows on. */
  date: string;
  /** "YYYY-MM-DD": the date it was set for, which a repeat counts from. */
  seriesDate: string;
  /** One of CALENDAR_RECURRENCES. */
  recurrence: string;
  /** "HH:MM", or null for an all-day entry. */
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  visibility: string;
  /** Who a "selected" entry is shared with, by name; empty otherwise. */
  sharedWith: { id: string; name: string }[];
  createdByName: string;
  /** Written by the viewer. Only the author decides who sees an entry. */
  isOwn: boolean;
  /** The viewer may edit or delete it. */
  canManage: boolean;
};

/**
 * Who may change or delete an entry: whoever wrote it, and admins when it is
 * shared with everyone. A private entry is its author's alone -- admins never
 * see it, so they cannot touch it either -- and the people a "selected" entry
 * is shared with only read it.
 */
export function canManageCalendarEvent(
  user: { id?: string; role?: string },
  event: { createdById: string; visibility: string }
) {
  if (user.id && event.createdById === user.id) {
    return true;
  }

  return user.role === "admin" && event.visibility === "everyone";
}

/** "Asha", "Asha and Ravi", "Asha, Ravi and Sara". */
export function listNames(names: string[]) {
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Who sees an entry, as a sentence for its dialog. */
export function describeSharing(entry: CalendarEntry) {
  if (entry.visibility === "everyone") {
    return entry.isOwn
      ? "Shared with everyone."
      : `Shared with everyone by ${entry.createdByName}.`;
  }

  if (entry.visibility === "selected") {
    return entry.isOwn
      ? `Shared with ${listNames(entry.sharedWith.map((person) => person.name))}.`
      : `Shared with you by ${entry.createdByName}.`;
  }

  return "Only you can see this entry.";
}

/** Today on the office clock, as "YYYY-MM-DD". */
export function officeToday() {
  return officeDate(new Date()).toISOString().slice(0, 10);
}

/** "2026-10", the form a calendar month travels in. */
export function isCalendarMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/**
 * "YYYY-MM-DD" as that day's UTC midnight, or null when it is not a real day.
 * "2026-02-31" would otherwise parse as March 3, so the date has to come back
 * out as the same text it went in as.
 */
export function parseCalendarDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

/** "14:30" from a time input; 24-hour, minutes only. */
export function isCalendarTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** The month `offset` months from `month`: ("2026-12", 1) is "2027-01". */
export function shiftCalendarMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
    .toISOString()
    .slice(0, 7);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday 0 to Sunday 6, for a week that starts on Monday. */
function weekdayFromMonday(date: Date) {
  return (date.getUTCDay() + 6) % 7;
}

/**
 * Every day a month's grid shows, as "YYYY-MM-DD": whole weeks, Monday first,
 * from the week the month starts in to the week it ends in. The days either
 * side of the month belong to its neighbours.
 */
export function calendarGridDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = Date.UTC(year, monthNumber - 1, 1);
  const last = Date.UTC(year, monthNumber, 0);
  const start = first - weekdayFromMonday(new Date(first)) * DAY_MS;
  const end = last + (6 - weekdayFromMonday(new Date(last))) * DAY_MS;
  const days: string[] = [];

  for (let day = start; day <= end; day += DAY_MS) {
    days.push(new Date(day).toISOString().slice(0, 10));
  }

  return days;
}

/**
 * The days from `from` to `to` (both "YYYY-MM-DD", inclusive) that an entry
 * set for `seriesDate` shows on, given how it repeats.
 */
export function occurrencesBetween(
  seriesDate: string,
  recurrence: string,
  from: string,
  to: string
) {
  const start = Date.parse(`${seriesDate}T00:00:00.000Z`);
  const first = Math.max(start, Date.parse(`${from}T00:00:00.000Z`));
  const last = Date.parse(`${to}T00:00:00.000Z`);
  const days: string[] = [];

  if (recurrence === "weekly") {
    // The first of its weekly dates on or after the range opens.
    const weeks = Math.ceil((first - start) / (7 * DAY_MS));

    for (let day = start + weeks * 7 * DAY_MS; day <= last; day += 7 * DAY_MS) {
      days.push(new Date(day).toISOString().slice(0, 10));
    }
  } else if (recurrence === "monthly") {
    const dayOfMonth = new Date(start).getUTCDate();
    const cursor = new Date(first);

    for (
      let year = cursor.getUTCFullYear(), month = cursor.getUTCMonth();
      Date.UTC(year, month, 1) <= last;
      month += 1
    ) {
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const day = Date.UTC(year, month, Math.min(dayOfMonth, daysInMonth));

      if (day >= first && day <= last) {
        days.push(new Date(day).toISOString().slice(0, 10));
      }
    }
  } else if (start >= first && start <= last) {
    days.push(seriesDate);
  }

  return days;
}

/** "Repeats every week", or null when it does not repeat. */
export function describeRecurrence(recurrence: string) {
  if (recurrence === "weekly") return "Repeats every week";
  if (recurrence === "monthly") return "Repeats every month";
  return null;
}

// Days are UTC midnights, so they are read back in UTC to stay on the same day.
const dayFormatter = new Intl.DateTimeFormat("en", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("en", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** "2026-10-26" -> "Monday, October 26". */
export function formatCalendarDay(day: string) {
  return dayFormatter.format(new Date(`${day}T00:00:00.000Z`));
}

/** "2026-10" -> "October 2026". */
export function formatCalendarMonth(month: string) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00.000Z`));
}

/** "14:30" -> "2:30 PM". */
export function formatCalendarTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${
    hours < 12 ? "AM" : "PM"
  }`;
}

/** "All day", "2:30 PM", or "2:30 PM – 3:30 PM". */
export function formatCalendarTimes(
  entry: Pick<CalendarEntry, "startTime" | "endTime">
) {
  if (!entry.startTime) {
    return "All day";
  }

  return entry.endTime
    ? `${formatCalendarTime(entry.startTime)} – ${formatCalendarTime(entry.endTime)}`
    : formatCalendarTime(entry.startTime);
}
