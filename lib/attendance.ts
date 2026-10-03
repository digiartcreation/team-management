/** A check-in and, once it has happened, the check-out that closed it. */
export type WorkSession = {
  id: string;
  checkInTime: Date;
  checkOutTime: Date | null;
};

type DayRecord = {
  id: string;
  actualCheckInTime: Date | null;
  actualCheckOutTime: Date | null;
  sessions: WorkSession[];
};

/**
 * The day's sessions, oldest first. Days recorded before sessions existed have
 * none, so their single check-in / check-out pair stands in as one session.
 */
export function sessionsOf(record: DayRecord): WorkSession[] {
  if (record.sessions.length > 0) {
    return [...record.sessions].sort(
      (a, b) => a.checkInTime.getTime() - b.checkInTime.getTime()
    );
  }

  return record.actualCheckInTime
    ? [
        {
          id: `${record.id}-legacy`,
          checkInTime: record.actualCheckInTime,
          checkOutTime: record.actualCheckOutTime,
        },
      ]
    : [];
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

/**
 * Time inside sessions and time between them. An open session counts up to
 * `now`, so today's total keeps moving while someone is checked in.
 */
export function summariseSessions(sessions: WorkSession[], now: Date) {
  let workedMinutes = 0;
  let breakMinutes = 0;

  sessions.forEach((session, index) => {
    workedMinutes += minutesBetween(
      session.checkInTime,
      session.checkOutTime ?? now
    );

    const previous = sessions[index - 1];

    if (previous?.checkOutTime) {
      breakMinutes += minutesBetween(previous.checkOutTime, session.checkInTime);
    }
  });

  const open = sessions.find((session) => !session.checkOutTime) ?? null;

  return { workedMinutes, breakMinutes, open };
}

/**
 * The month a stored day belongs to, as the page's month filter names it:
 * "2026-09". Days are stored as their UTC midnight, so the UTC month is theirs.
 */
export function monthKeyOf(day: Date) {
  return day.toISOString().slice(0, 7);
}

function parseMonthKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

/** The stored days of a month: from its first UTC midnight up to the next month's. */
export function monthRange(key: string) {
  const { year, month } = parseMonthKey(key);

  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

const monthNameFormatter = new Intl.DateTimeFormat("en", {
  timeZone: "UTC",
  month: "short",
});

/** "2026-09" -> "Sep-2026". */
export function monthLabel(key: string) {
  const { gte } = monthRange(key);
  return `${monthNameFormatter.format(gte)}-${gte.getUTCFullYear()}`;
}

/** Every month from `first` through `last`, newest first. */
export function monthsBetween(first: string, last: string) {
  const months: string[] = [];
  let { year, month } = parseMonthKey(last);

  for (let key = last; key >= first; ) {
    months.push(key);
    month -= 1;

    if (month === 0) {
      month = 12;
      year -= 1;
    }

    key = `${year}-${String(month).padStart(2, "0")}`;
  }

  return months;
}
