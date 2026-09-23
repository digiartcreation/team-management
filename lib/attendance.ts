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
