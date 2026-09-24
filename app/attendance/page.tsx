import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserTeamIds, usersOnTeams } from "@/lib/teams";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { checkIn, checkOut } from "@/app/attendance/actions";
import { sessionsOf, summariseSessions } from "@/lib/attendance";
import { formatDuration } from "@/lib/duration";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en", {
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

export default async function AttendancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
  };
  // A manager sees the people on any of their teams.
  const managerTeamIds =
    sessionUser.role === "manager" ? await getUserTeamIds(sessionUser.id) : [];
  const where: Prisma.AttendanceRecordWhereInput =
    sessionUser.role === "admin"
      ? {}
      : sessionUser.role === "manager"
        ? { user: usersOnTeams(managerTeamIds) }
        : { userId: sessionUser.id };
  const records = await prisma.attendanceRecord.findMany({
    where,
    orderBy: { date: "desc" },
    take: 60,
    include: {
      user: { select: { id: true, name: true } },
      sessions: sessionSelect,
    },
  });
  const now = new Date();
  const todayDate = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const ownTodayRecord = sessionUser.id
    ? await prisma.attendanceRecord.findUnique({
        where: { userId_date: { userId: sessionUser.id, date: todayDate } },
        include: { sessions: sessionSelect },
      })
    : null;
  const todaySessions = ownTodayRecord ? sessionsOf(ownTodayRecord) : [];
  const today = summariseSessions(todaySessions, now);
  const showEmployeeColumn = sessionUser.role !== "member";
  const canCheckIn = sessionUser.role !== "admin";

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
                    <dt className="text-xs text-slate-500">Worked</dt>
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

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {records.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No attendance records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1060px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    {showEmployeeColumn ? <th className="px-4 py-3">Employee</th> : null}
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">First In</th>
                    <th className="px-4 py-3">Last Out</th>
                    <th className="px-4 py-3">Sessions</th>
                    <th className="px-4 py-3">Worked</th>
                    <th className="px-4 py-3">Breaks</th>
                    <th className="px-4 py-3">Late</th>
                    <th className="px-4 py-3">Early Departure</th>
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
                        {showEmployeeColumn ? (
                          <td className="px-4 py-4 font-medium text-slate-950">{record.user.name}</td>
                        ) : null}
                        <td className="px-4 py-4">
                          <StatusBadge status={record.status} />
                        </td>
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
                        <td className="px-4 py-4 text-slate-600">
                          {day.breakMinutes > 0 ? formatDuration(day.breakMinutes) : "None"}
                        </td>
                        <td className="px-4 py-4 text-slate-600">{record.lateDurationMinutes ? `${record.lateDurationMinutes} min` : "None"}</td>
                        <td className="px-4 py-4 text-slate-600">{record.earlyDepartureMinutes ? `${record.earlyDepartureMinutes} min` : "None"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
