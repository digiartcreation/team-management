import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MonthFilter from "@/components/attendance/MonthFilter";
import Avatar from "@/components/ui/Avatar";
import { checkIn, checkOut } from "@/app/attendance/actions";
import { SUPER_ADMIN } from "@/lib/roles";
import {
  monthKeyOf,
  monthLabel,
  monthRange,
  monthsBetween,
  sessionsOf,
  summariseSessions,
} from "@/lib/attendance";
import { formatDuration } from "@/lib/duration";
import {
  CHECK_OUT_CUTOFF,
  autoCheckOutAt,
  closeExpiredSessions,
  isCheckOutClosed,
} from "@/lib/autoCheckOut";
import {
  OFFICE_TIME_ZONE,
  minutesFromTime,
  officeDate,
  officeMinutes,
} from "@/lib/officeTime";

// A day is stored as its UTC midnight, so it is read back in UTC; times are
// shown on the office clock, not the server's.
const dateFormatter = new Intl.DateTimeFormat("en", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en", {
  timeZone: OFFICE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

function formatTime(value: Date | null) {
  return value ? timeFormatter.format(value) : "Not recorded";
}

/**
 * Past 9:20 on the office clock: when the Check-In button turns red, and when
 * a day's First In is shown in red. (The Late status itself starts at 9:01.)
 */
function isRedCheckIn(value: Date) {
  return officeMinutes(value) > 9 * 60 + 20;
}

const clockFormatter = new Intl.DateTimeFormat("en", {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
});

/** A shift time the way the page shows times: "18:00" -> "06:00 PM". */
function formatClock(value: string) {
  return clockFormatter.format(new Date(minutesFromTime(value) * 60_000));
}

const sessionSelect = {
  orderBy: { checkInTime: "asc" },
  select: { id: true, checkInTime: true, checkOutTime: true },
} satisfies Prisma.AttendanceRecord$sessionsArgs;

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Present"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "Late"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : status === "Leave"
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${tone}`}>
      {status}
    </span>
  );
}

const recordInclude = {
  user: { select: { id: true, name: true } },
  sessions: sessionSelect,
} satisfies Prisma.AttendanceRecordInclude;

type AttendanceRow = Prisma.AttendanceRecordGetPayload<{
  include: typeof recordInclude;
}>;

/** A line of the table: a day with a check-in, or a working day without one. */
type DayRow =
  | { kind: "record"; record: AttendanceRow }
  | { kind: "leave"; date: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The working days of `month` that went by without a check-in: every day but
 * Sunday, from `from` -- when the person joined, or attendance began -- up to
 * yesterday. Today is left alone; there is still time to check in.
 */
function leaveDaysOf(
  month: string,
  from: Date,
  today: Date,
  recorded: Set<number>
) {
  const { gte, lt } = monthRange(month);
  const days: Date[] = [];

  for (
    let day = Math.max(gte.getTime(), from.getTime());
    day < Math.min(lt.getTime(), today.getTime());
    day += DAY_MS
  ) {
    const date = new Date(day);

    if (date.getUTCDay() !== 0 && !recorded.has(day)) {
      days.push(date);
    }
  }

  return days;
}

/** A person's days with check-ins and their leave days, newest first. */
function dayRowsOf(records: AttendanceRow[], leaveDays: Date[]): DayRow[] {
  return [
    ...records.map((record): DayRow => ({ kind: "record", record })),
    ...leaveDays.map((date): DayRow => ({ kind: "leave", date })),
  ].sort(
    (a, b) =>
      (b.kind === "record" ? b.record.date : b.date).getTime() -
      (a.kind === "record" ? a.record.date : a.date).getTime()
  );
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * One person's days, newest first, leave days among them. Employees get the
 * plain log: no Late / Present status, breaks, lateness or early departure.
 */
function AttendanceTable({
  rows,
  now,
  detailed,
}: {
  rows: DayRow[];
  now: Date;
  detailed: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full text-left text-sm ${detailed ? "min-w-[900px]" : "min-w-[600px]"}`}
      >
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Date</th>
            {detailed ? <th className="px-4 py-3">Status</th> : null}
            <th className="px-4 py-3">First In</th>
            <th className="px-4 py-3">Last Out</th>
            <th className="px-4 py-3">Sessions</th>
            <th className="px-4 py-3">Total Hours</th>
            {detailed ? (
              <>
                <th className="px-4 py-3">Breaks</th>
                <th className="px-4 py-3">Late</th>
                <th className="px-4 py-3">Early Departure</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => {
            if (row.kind === "leave") {
              return (
                <tr key={`leave-${row.date.getTime()}`} className="align-top bg-rose-50/40">
                  <td className="px-4 py-4 text-slate-600">
                    {dateFormatter.format(row.date)}
                    <div className="mt-0.5 text-xs text-slate-400">No check-in</div>
                  </td>
                  {detailed ? (
                    <td className="px-4 py-4">
                      <StatusBadge status="Leave" />
                    </td>
                  ) : null}
                  <td className="px-4 py-4 font-medium text-rose-700">Leave</td>
                  <td className="px-4 py-4 text-slate-400">–</td>
                  <td className="px-4 py-4 text-slate-400">0</td>
                  <td className="px-4 py-4 text-slate-400">None</td>
                  {detailed ? (
                    <>
                      <td className="px-4 py-4 text-slate-400">–</td>
                      <td className="px-4 py-4 text-slate-400">–</td>
                      <td className="px-4 py-4 text-slate-400">–</td>
                    </>
                  ) : null}
                </tr>
              );
            }

            const { record } = row;
            const sessions = sessionsOf(record);
            const day = summariseSessions(sessions, now);

            return (
              <tr key={record.id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-4 text-slate-600">
                  {dateFormatter.format(record.date)}
                  <div className="mt-0.5 text-xs text-slate-400">
                    Shift {record.scheduledStartTime}–{record.scheduledEndTime}
                  </div>
                </td>
                {detailed ? (
                  <td className="px-4 py-4">
                    <StatusBadge status={record.status} />
                  </td>
                ) : null}
                <td
                  className={`px-4 py-4 font-medium ${
                    !record.actualCheckInTime
                      ? "text-slate-600"
                      : isRedCheckIn(record.actualCheckInTime)
                        ? "text-red-600"
                        : "text-emerald-700"
                  }`}
                >
                  {formatTime(record.actualCheckInTime)}
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {day.open ? (
                    <span className="font-medium text-emerald-700">Checked in</span>
                  ) : (
                    formatTime(record.actualCheckOutTime)
                  )}
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {sessions.length > 1 ? (
                    <details>
                      <summary className="cursor-pointer font-medium text-[#770FC2]">
                        {sessions.length} sessions
                      </summary>
                      <ol className="mt-2 grid gap-1 text-xs">
                        {sessions.map((item) => (
                          <li key={item.id} className="tabular-nums">
                            {timeFormatter.format(item.checkInTime)} →{" "}
                            {item.checkOutTime ? timeFormatter.format(item.checkOutTime) : "now"}
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : (
                    sessions.length
                  )}
                </td>
                <td className="px-4 py-4 font-medium text-slate-800">
                  {sessions.length > 0 ? formatDuration(day.workedMinutes) : "None"}
                </td>
                {detailed ? (
                  <>
                    <td className="px-4 py-4 text-slate-600">
                      {day.breakMinutes > 0 ? formatDuration(day.breakMinutes) : "None"}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{record.lateDurationMinutes ? `${record.lateDurationMinutes} min` : "None"}</td>
                    <td className="px-4 py-4 text-slate-600">{record.earlyDepartureMinutes ? `${record.earlyDepartureMinutes} min` : "None"}</td>
                  </>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type AttendancePageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
    isSuperAdmin?: boolean;
  };
  // Only a super admin sees everyone's attendance. Admins, managers and
  // employees alike see -- and check in for -- their own days.
  const isSuperAdmin = sessionUser.isSuperAdmin === true;
  const where: Prisma.AttendanceRecordWhereInput = isSuperAdmin
    ? {}
    : { userId: sessionUser.id ?? "__no_user__" };
  const now = new Date();
  // Sessions left open past 10 PM are checked out (30 minutes after their
  // check-in) before any day is read, so the page never shows one running.
  await closeExpiredSessions(now);
  const isLateForCheckIn = isRedCheckIn(now);
  const checkInClosed = isCheckOutClosed(now);
  const todayDate = officeDate(now);
  const [earliest, ownTodayRecord] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      where,
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    sessionUser.id
      ? prisma.attendanceRecord.findUnique({
          where: { userId_date: { userId: sessionUser.id, date: todayDate } },
          include: { sessions: sessionSelect },
        })
      : null,
  ]);

  // The filter offers every month from the first recorded day to this one, and
  // opens on this month.
  const currentMonth = monthKeyOf(todayDate);
  const earliestMonth = earliest ? monthKeyOf(earliest.date) : currentMonth;
  const months = monthsBetween(
    earliestMonth < currentMonth ? earliestMonth : currentMonth,
    currentMonth
  );
  const { month } = await searchParams;
  const selectedMonth = month && months.includes(month) ? month : currentMonth;

  const [records, trackingStart, staff] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { ...where, date: monthRange(selectedMonth) },
      orderBy: { date: "desc" },
      include: recordInclude,
    }),
    // Leave is counted from the first day anyone checked in, never before.
    prisma.attendanceRecord.findFirst({
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    // Whose leave to count: everyone who checks in (all but super admins) for
    // the super admin's view, yourself for everyone else's.
    prisma.user.findMany({
      where: isSuperAdmin
        ? { role: { not: SUPER_ADMIN } }
        : { id: sessionUser.id ?? "__no_user__" },
      select: { id: true, name: true, createdAt: true },
    }),
  ]);
  const todaySessions = ownTodayRecord ? sessionsOf(ownTodayRecord) : [];
  const today = summariseSessions(todaySessions, now);
  const isMember = sessionUser.role === "member";
  const canCheckIn = !isSuperAdmin;

  // One block per person for the super admin, the way the task board does;
  // everyone else has the one, their own.
  const people = new Map<
    string,
    { id: string; name: string; joined: Date | null; records: AttendanceRow[] }
  >(staff.map((person) => [person.id, { ...person, joined: person.createdAt, records: [] }]));

  for (const record of records) {
    const person = people.get(record.user.id) ?? {
      ...record.user,
      // Someone left out of `staff` (a super admin's old days): no leave.
      joined: null,
      records: [],
    };
    person.records.push(record);
    people.set(person.id, person);
  }

  const groups = [...people.values()]
    .map((person) => {
      const leaveDays =
        trackingStart && person.joined
          ? leaveDaysOf(
              selectedMonth,
              new Date(
                Math.max(trackingStart.date.getTime(), officeDate(person.joined).getTime())
              ),
              todayDate,
              new Set(person.records.map((record) => record.date.getTime()))
            )
          : [];

      return {
        id: person.id,
        name: person.name,
        records: person.records,
        leaveDays: leaveDays.length,
        rows: dayRowsOf(person.records, leaveDays),
        workedMinutes: person.records.reduce(
          (sum, record) =>
            sum + summariseSessions(sessionsOf(record), now).workedMinutes,
          0
        ),
        lateDays: person.records.filter((record) => record.status === "Late").length,
      };
    })
    .filter((person) => person.rows.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const ownRows = groups[0]?.rows ?? [];
  const ownLeaveDays = groups[0]?.leaveDays ?? 0;

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header>
          <p className="text-sm font-medium uppercase text-slate-500">
            Attendance
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Attendance Tracking
          </h1>
        </header>

        {canCheckIn ? (
          <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_1.4fr]">
            <div className="flex flex-col justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Today
                </p>
                <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-950">
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 rounded-full ${
                      today.open ? "animate-pulse bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                  {today.open
                    ? `Checked in since ${timeFormatter.format(today.open.checkInTime)}`
                    : todaySessions.length > 0
                      ? `Checked out at ${formatTime(todaySessions[todaySessions.length - 1].checkOutTime)}`
                      : "Not checked in yet"}
                </p>
                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-md bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Total Hours</dt>
                    <dd className="mt-1 font-semibold text-slate-950">
                      {formatDuration(today.workedMinutes)}
                    </dd>
                  </div>
                  <div className="rounded-md bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Breaks</dt>
                    <dd className="mt-1 font-semibold text-slate-950">
                      {formatDuration(today.breakMinutes)}
                    </dd>
                  </div>
                  <div className="rounded-md bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Sessions</dt>
                    <dd className="mt-1 font-semibold text-slate-950">
                      {todaySessions.length}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* One button that flips: in when out, out when in, as often as needed. */}
              {today.open ? (
                <form action={checkOut} className="grid gap-2">
                  <button className="w-full rounded-md border border-[#770FC2] px-4 py-2.5 text-sm font-medium text-[#770FC2] transition hover:bg-[#F3E8FF]">
                    Check-Out
                  </button>
                  {ownTodayRecord ? (
                    <p className="text-center text-xs text-slate-500">
                      Check out by {formatClock(CHECK_OUT_CUTOFF)}. If you
                      don&apos;t, this session closes at{" "}
                      {formatTime(
                        autoCheckOutAt(ownTodayRecord.date, today.open.checkInTime)
                      )}
                      .
                    </p>
                  ) : null}
                </form>
              ) : checkInClosed ? (
                <div className="grid gap-2">
                  <button
                    disabled
                    className="w-full cursor-not-allowed rounded-md bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-500"
                  >
                    Check-In
                  </button>
                  <p className="text-center text-xs text-slate-500">
                    Attendance closes at {formatClock(CHECK_OUT_CUTOFF)}. Check
                    in again tomorrow.
                  </p>
                </div>
              ) : (
                <form action={checkIn}>
                  <button
                    className={`w-full rounded-md px-4 py-2.5 text-sm font-medium text-white transition ${
                      isLateForCheckIn
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {todaySessions.length > 0 ? "Check-In Again" : "Check-In"}
                  </button>
                </form>
              )}
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Today&apos;s sessions
              </p>
              {todaySessions.length === 0 ? (
                <p className="mt-3 rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  Your check-ins and check-outs will appear here.
                </p>
              ) : (
                <ol className="mt-3 grid gap-2">
                  {todaySessions.map((item, index) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F3E8FF] text-xs font-semibold text-[#770FC2]">
                          {index + 1}
                        </span>
                        <span className="text-slate-700">
                          <span className="font-medium text-slate-950">
                            {timeFormatter.format(item.checkInTime)}
                          </span>
                          {" → "}
                          {item.checkOutTime ? (
                            <span className="font-medium text-slate-950">
                              {timeFormatter.format(item.checkOutTime)}
                            </span>
                          ) : (
                            <span className="font-medium text-emerald-700">now</span>
                          )}
                        </span>
                      </span>
                      <span className="tabular-nums text-slate-500">
                        {formatDuration(
                          Math.round(
                            ((item.checkOutTime ?? now).getTime() -
                              item.checkInTime.getTime()) /
                              60000
                          )
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {monthLabel(selectedMonth)}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isSuperAdmin
                  ? `${plural(groups.length, "person", "people")} · ${plural(records.length, "day")} recorded`
                  : `${plural(records.length, "day")} recorded · ${plural(ownLeaveDays, "leave day")}`}
              </p>
            </div>
            <MonthFilter
              months={months.map((key) => ({ value: key, label: monthLabel(key) }))}
              selected={selectedMonth}
              path="/attendance"
            />
          </div>

          {groups.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No attendance recorded in {monthLabel(selectedMonth)}.
            </p>
          ) : !isSuperAdmin ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <AttendanceTable rows={ownRows} now={now} detailed={!isMember} />
            </div>
          ) : (
            groups.map((group) => (
              <details
                key={group.id}
                open
                className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={group.name} />
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {group.name}
                    </span>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                      {plural(group.records.length, "day")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4">
                    <span className="hidden text-xs text-slate-500 sm:inline">
                      Worked {formatDuration(group.workedMinutes)} · {group.lateDays} late ·{" "}
                      {group.leaveDays} leave
                    </span>
                    <span
                      aria-hidden
                      className="-rotate-90 text-xs text-slate-400 transition group-open:rotate-0"
                    >
                      &#9660;
                    </span>
                  </span>
                </summary>
                <div className="border-t border-slate-100">
                  <AttendanceTable rows={group.rows} now={now} detailed />
                </div>
              </details>
            ))
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
