import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MonthFilter from "@/components/attendance/MonthFilter";
import Avatar from "@/components/ui/Avatar";
import { checkIn, checkOut } from "@/app/attendance/actions";
import {
  monthKeyOf,
  monthLabel,
  monthRange,
  monthsBetween,
  sessionsOf,
  summariseSessions,
} from "@/lib/attendance";
import { formatDuration } from "@/lib/duration";
import { OFFICE_TIME_ZONE, officeDate } from "@/lib/officeTime";

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

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * One person's days, newest first. Employees get the plain log: no Late /
 * Present status, breaks, lateness or early departure.
 */
function AttendanceTable({
  records,
  now,
  detailed,
}: {
  records: AttendanceRow[];
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
          {records.map((record) => {
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
                <td className="px-4 py-4 text-slate-600">{formatTime(record.actualCheckInTime)}</td>
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

  const records = await prisma.attendanceRecord.findMany({
    where: { ...where, date: monthRange(selectedMonth) },
    orderBy: { date: "desc" },
    include: recordInclude,
  });
  const todaySessions = ownTodayRecord ? sessionsOf(ownTodayRecord) : [];
  const today = summariseSessions(todaySessions, now);
  const isMember = sessionUser.role === "member";
  const canCheckIn = !isSuperAdmin;

  // The super admin sees one block per person, the way the task board does.
  const people = new Map<string, { id: string; name: string; records: AttendanceRow[] }>();

  for (const record of records) {
    const person = people.get(record.user.id) ?? {
      ...record.user,
      records: [],
    };
    person.records.push(record);
    people.set(person.id, person);
  }

  const groups = [...people.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((person) => ({
      ...person,
      workedMinutes: person.records.reduce(
        (sum, record) =>
          sum + summariseSessions(sessionsOf(record), now).workedMinutes,
        0
      ),
      lateDays: person.records.filter((record) => record.status === "Late").length,
    }));

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
                <form action={checkOut}>
                  <button className="w-full rounded-md border border-[#770FC2] px-4 py-2.5 text-sm font-medium text-[#770FC2] transition hover:bg-[#F3E8FF]">
                    Check-Out
                  </button>
                </form>
              ) : (
                <form action={checkIn}>
                  <button className="w-full rounded-md bg-[#770FC2] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#6B1BBD]">
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
                  : `${plural(records.length, "day")} recorded`}
              </p>
            </div>
            <MonthFilter
              months={months.map((key) => ({ value: key, label: monthLabel(key) }))}
              selected={selectedMonth}
            />
          </div>

          {records.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No attendance recorded in {monthLabel(selectedMonth)}.
            </p>
          ) : !isSuperAdmin ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <AttendanceTable records={records} now={now} detailed={!isMember} />
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
                      Worked {formatDuration(group.workedMinutes)} · {group.lateDays} late
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
                  <AttendanceTable records={group.records} now={now} detailed />
                </div>
              </details>
            ))
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
