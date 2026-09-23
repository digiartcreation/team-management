import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import BreakdownTable from "@/components/reports/BreakdownTable";
import ReportCharts from "@/components/reports/ReportCharts";
import ReportExport from "@/components/reports/ReportExport";
import { formatDuration } from "@/lib/duration";
import {
  buildReportAnalytics,
  datePresets,
  previousPeriod,
} from "@/lib/reportAnalytics";
import {
  DEFAULT_REPORT_VIEW,
  INTERNAL_LABEL,
  REPORT_VIEWS,
  REPORT_VIEW_DEFINITIONS,
  UNMAPPED_SERVICE_LABEL,
  buildReopenSummary,
  buildReport,
  groupTimeByPerson,
  isReportView,
  serviceNameOf,
} from "@/lib/reports";

type ReportFilters = {
  from?: string;
  to?: string;
  clientId?: string;
  userId?: string;
  service?: string;
  view?: string;
};

type ReportsPageProps = {
  searchParams: Promise<ReportFilters>;
};

/** Marks the "no service mapped" choice in the service filter. */
const UNMAPPED_SERVICE = "__unmapped__";

/** What the ranking chart is called on each tab. */
const RANKING_COPY = {
  client: {
    title: "Top clients",
    subtitle: "Hours per client, first pass and rework",
  },
  employee: {
    title: "Top employees",
    subtitle: "Hours per employee, first pass and rework",
  },
  service: {
    title: "Top services",
    subtitle: "Hours per service, first pass and rework",
  },
};

const displayDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Accepts only the "YYYY-MM-DD" a date input produces. */
function parseDateInput(raw: string | undefined) {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const date = new Date(`${raw}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(raw: string) {
  return new Date(`${raw}T23:59:59.999Z`);
}

/** Today in the server's local calendar, as the date inputs use it. */
function todayUtcMidnight() {
  return new Date(`${new Date().toLocaleDateString("en-CA")}T00:00:00.000Z`);
}

/** Keeps the current filters on a link, dropping the ones left blank. */
function reportHref(filters: ReportFilters) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();

  return query ? `/reports?${query}` : "/reports";
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

const labelClass = "text-xs font-medium uppercase tracking-wide text-slate-500";

/** Signed change against the previous period, coloured by whether up is good. */
function Delta({
  current,
  previous,
  label,
  upIsGood,
}: {
  current: number;
  previous: number;
  label: string;
  upIsGood: boolean;
}) {
  if (previous === 0) {
    return current > 0 ? (
      <span className="text-xs text-slate-500">New vs {label}</span>
    ) : (
      <span className="text-xs text-slate-500">No change vs {label}</span>
    );
  }

  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);
  const good = rounded === 0 ? null : rounded > 0 === upIsGood;

  return (
    <span className="flex items-center gap-1 text-xs">
      <span
        className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-semibold ${
          good === null
            ? "bg-slate-100 text-slate-600"
            : good
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
        }`}
      >
        <span aria-hidden>{rounded > 0 ? "▲" : rounded < 0 ? "▼" : "•"}</span>
        {rounded > 0 ? "+" : ""}
        {rounded}%
      </span>
      <span className="text-slate-500">vs {label}</span>
    </span>
  );
}

function KpiTile({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        accent
          ? "border-transparent bg-linear-to-br from-[#770FC2] to-[#4C0880] text-white"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className={`text-xs font-medium ${accent ? "text-white/75" : "text-slate-500"}`}>
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          accent ? "text-white" : "text-slate-950"
        }`}
      >
        {value}
      </p>
      <div className={`mt-2 min-h-5 ${accent ? "**:text-white/85! [&_span.rounded]:bg-white/15!" : ""}`}>
        {hint}
      </div>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    role?: string;
  };

  if (sessionUser.role !== "admin") {
    redirect("/");
  }

  const filters = await searchParams;
  const view = isReportView(filters.view) ? filters.view : DEFAULT_REPORT_VIEW;
  const definition = REPORT_VIEW_DEFINITIONS[view];
  const from = parseDateInput(filters.from);
  const to = parseDateInput(filters.to);

  // Every service a task has actually been mapped to. It both fills the filter
  // and turns the chosen service back into the exact stored values, since
  // "Digital Marketing" has to match "Digital Marketing (SEO)" as well.
  const mappedWork = await prisma.task.findMany({
    where: { clientWork: { not: null } },
    select: { clientWork: true },
    distinct: ["clientWork"],
    orderBy: { clientWork: "asc" },
  });

  const workValues = mappedWork
    .map((task) => task.clientWork)
    .filter((work): work is string => Boolean(work));

  const serviceOptions = [
    ...new Set(
      workValues
        .map((work) => serviceNameOf(work))
        .filter((service): service is string => Boolean(service))
    ),
  ].sort((a, b) => a.localeCompare(b));

  // Everything but the date, so the previous period can reuse it.
  const scopeWhere: Prisma.TaskTimeLogWhereInput = {};
  const taskFilter: Prisma.TaskWhereInput = {};

  if (filters.clientId) {
    taskFilter.clientId =
      filters.clientId === "__internal__" ? null : filters.clientId;
  }

  if (filters.service === UNMAPPED_SERVICE) {
    taskFilter.clientWork = null;
  } else if (filters.service) {
    // An unknown service leaves an empty list, which matches nothing.
    taskFilter.clientWork = {
      in: workValues.filter((work) => serviceNameOf(work) === filters.service),
    };
  }

  if (Object.keys(taskFilter).length > 0) {
    scopeWhere.task = taskFilter;
  }

  if (filters.userId) {
    scopeWhere.userId = filters.userId;
  }

  const where: Prisma.TaskTimeLogWhereInput = { ...scopeWhere };

  if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      // Inclusive of the chosen day, whatever time the entry carries.
      ...(to && filters.to ? { lte: endOfDay(filters.to) } : {}),
    };
  }

  const previousWindow = previousPeriod(from, to);
  const previousWhere: Prisma.TaskTimeLogWhereInput | null = previousWindow
    ? {
        ...scopeWhere,
        date: { gte: previousWindow.from, lte: previousWindow.toEnd },
      }
    : null;

  const [logs, clientOptions, userOptions, previousTotal, previousRework] =
    await Promise.all([
      prisma.taskTimeLog.findMany({
        where,
        select: {
          id: true,
          minutes: true,
          date: true,
          reopenCycle: true,
          note: true,
          user: { select: { id: true, name: true } },
          task: {
            select: {
              id: true,
              title: true,
              clientWork: true,
              reopenCount: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.client.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, role: true },
      }),
      previousWhere
        ? prisma.taskTimeLog.aggregate({
            where: previousWhere,
            _sum: { minutes: true },
          })
        : null,
      previousWhere
        ? prisma.taskTimeLog.aggregate({
            where: { ...previousWhere, reopenCycle: { gt: 0 } },
            _sum: { minutes: true },
          })
        : null,
    ]);

  const groups = buildReport(logs, view);
  const byPerson = groupTimeByPerson(logs);
  const reopenedTasks = buildReopenSummary(logs);
  const analytics = buildReportAnalytics({
    logs,
    view,
    from,
    to,
    previous: previousWindow
      ? {
          total: previousTotal?._sum.minutes ?? 0,
          rework: previousRework?._sum.minutes ?? 0,
          label: previousWindow.label,
        }
      : null,
  });
  const { kpis } = analytics;

  // The reason lives on the reopen record rather than on any time log, so it
  // takes a second query -- only for the tasks the summary actually lists.
  const reopenReasons = await prisma.taskReopen.findMany({
    where: {
      taskId: { in: reopenedTasks.map((task) => task.taskId) },
      reason: { not: null },
    },
    select: {
      taskId: true,
      cycle: true,
      reason: true,
      user: { select: { name: true } },
    },
  });

  const reasons = Object.fromEntries(
    reopenReasons.map((row) => [
      `${row.taskId}:${row.cycle}`,
      { reason: row.reason, by: row.user.name },
    ])
  );

  // A one-line description of the slice, for the page and the exports.
  const rangeText =
    from && to
      ? `${displayDate.format(from)} – ${displayDate.format(to)}`
      : from
        ? `From ${displayDate.format(from)}`
        : to
          ? `Up to ${displayDate.format(to)}`
          : "All time";
  const scopeParts = [rangeText];

  if (filters.clientId) {
    scopeParts.push(
      `Client: ${
        filters.clientId === "__internal__"
          ? INTERNAL_LABEL
          : (clientOptions.find((client) => client.id === filters.clientId)?.name ?? "Unknown")
      }`
    );
  }

  if (filters.service) {
    scopeParts.push(
      `Service: ${filters.service === UNMAPPED_SERVICE ? UNMAPPED_SERVICE_LABEL : filters.service}`
    );
  }

  if (filters.userId) {
    scopeParts.push(
      `Employee: ${userOptions.find((user) => user.id === filters.userId)?.name ?? "Unknown"}`
    );
  }

  const scope = scopeParts.join(" · ");
  const fileStem = `time-report-${view}-${filters.from ?? "start"}-to-${filters.to ?? "today"}`;
  const presets = datePresets(todayUtcMidnight());
  const activePreset = presets.find(
    (preset) => preset.from === filters.from && preset.to === filters.to
  );
  const previous = kpis.previous;

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#770FC2]">
              Reports &amp; analytics
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold text-slate-950 sm:text-3xl">
              {definition.heading}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                <svg aria-hidden viewBox="0 0 20 20" className="h-3.5 w-3.5 text-[#770FC2]" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="4" width="14" height="13" rx="2" />
                  <path d="M3 8h14M7 2.5v3M13 2.5v3" />
                </svg>
                {scope}
              </span>
            </p>
          </div>
          <ReportExport
            heading={definition.heading}
            scope={scope}
            fileStem={fileStem}
            groupHeading={definition.groupHeading}
            detailHeadings={definition.detailHeadings}
            showPeople={definition.showPeople}
            groups={groups}
            reopened={reopenedTasks}
            reasons={reasons}
            analytics={analytics}
          />
        </header>

        {/* View tabs + quick ranges */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {REPORT_VIEWS.map((option) => (
              <Link
                key={option}
                href={reportHref({ ...filters, view: option })}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  option === view
                    ? "bg-[#770FC2] text-white shadow-sm"
                    : "text-slate-600 hover:bg-[#F3E8FF] hover:text-[#770FC2]"
                }`}
              >
                {REPORT_VIEW_DEFINITIONS[option].tab}
              </Link>
            ))}
          </nav>

          <div className="flex flex-wrap gap-1.5">
            <Link
              href={reportHref({ ...filters, from: undefined, to: undefined })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                !filters.from && !filters.to
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-600 ring-slate-200 hover:ring-[#A05DD0]"
              }`}
            >
              All time
            </Link>
            {presets.map((preset) => (
              <Link
                key={preset.label}
                href={reportHref({ ...filters, from: preset.from, to: preset.to })}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                  activePreset?.label === preset.label
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-600 ring-slate-200 hover:ring-[#A05DD0]"
                }`}
              >
                {preset.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Filters: one row that scopes everything below */}
        <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
          <input type="hidden" name="view" value={view} />

          <label className="grid gap-1.5">
            <span className={labelClass}>From</span>
            <input name="from" type="date" defaultValue={filters.from ?? ""} className={inputClass} />
          </label>

          <label className="grid gap-1.5">
            <span className={labelClass}>To</span>
            <input name="to" type="date" defaultValue={filters.to ?? ""} className={inputClass} />
          </label>

          <label className="grid gap-1.5">
            <span className={labelClass}>Client</span>
            <select name="clientId" defaultValue={filters.clientId ?? ""} className={inputClass}>
              <option value="">All clients</option>
              <option value="__internal__">{INTERNAL_LABEL}</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className={labelClass}>Service</span>
            <select name="service" defaultValue={filters.service ?? ""} className={inputClass}>
              <option value="">All services</option>
              <option value={UNMAPPED_SERVICE}>{UNMAPPED_SERVICE_LABEL}</option>
              {serviceOptions.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className={labelClass}>Employee</span>
            <select name="userId" defaultValue={filters.userId ?? ""} className={inputClass}>
              <option value="">All employees</option>
              {userOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role === "member" ? "employee" : user.role})
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Apply
            </button>
            <Link
              href={reportHref({ view })}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Reset
            </Link>
          </div>
        </form>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiTile
            accent
            label="Total time logged"
            value={formatDuration(kpis.total)}
            hint={
              previous ? (
                <Delta current={kpis.total} previous={previous.total} label={previous.label} upIsGood />
              ) : (
                <span className="text-xs">{kpis.entries} time entries</span>
              )
            }
          />
          <KpiTile
            label="First pass"
            value={formatDuration(kpis.firstPass)}
            hint={
              <span className="text-xs text-slate-500">
                {kpis.total > 0 ? Math.round((kpis.firstPass / kpis.total) * 100) : 0}% of all time
              </span>
            }
          />
          <KpiTile
            label="Rework"
            value={formatDuration(kpis.rework)}
            hint={
              previous ? (
                <Delta current={kpis.rework} previous={previous.rework} label={previous.label} upIsGood={false} />
              ) : (
                <span className="text-xs text-slate-500">
                  {kpis.reworkRate.toFixed(1)}% rework rate
                </span>
              )
            }
          />
          <KpiTile
            label="Reopened tasks"
            value={kpis.reopenedTasks}
            hint={
              <span className="text-xs text-slate-500">
                of {kpis.tasks} {kpis.tasks === 1 ? "task" : "tasks"} worked on
              </span>
            }
          />
          <KpiTile
            label="Avg. per task"
            value={formatDuration(kpis.averagePerTask)}
            hint={<span className="text-xs text-slate-500">{kpis.tasks} tasks</span>}
          />
          <KpiTile
            label="Avg. per active day"
            value={formatDuration(kpis.averagePerDay)}
            hint={
              <span className="text-xs text-slate-500">
                {kpis.activeDays} {kpis.activeDays === 1 ? "day" : "days"} with time logged
              </span>
            }
          />
          <KpiTile
            label="People"
            value={kpis.employees}
            hint={<span className="text-xs text-slate-500">who logged time</span>}
          />
          <KpiTile
            label="Clients · Services"
            value={`${kpis.clients} · ${kpis.services}`}
            hint={<span className="text-xs text-slate-500">with time in range</span>}
          />
        </div>

        <ReportCharts
          data={analytics}
          rankingTitle={RANKING_COPY[view].title}
          rankingSubtitle={RANKING_COPY[view].subtitle}
        />

        <BreakdownTable
          groupHeading={definition.groupHeading}
          detailHeadings={definition.detailHeadings}
          showPeople={definition.showPeople}
          groups={groups}
          total={kpis.total}
        />

        <div className={`grid gap-5 ${view !== "employee" && byPerson.length > 0 ? "lg:grid-cols-3" : ""}`}>
          {/* The reopen flow in full: how often each task came back, what each
              return cost, and why it was sent back. */}
          <section
            className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${
              view !== "employee" && byPerson.length > 0 ? "lg:col-span-2" : ""
            }`}
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">Reopened tasks</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Rework hours are part of the totals above, not extra, and cover the selected range only.
              </p>
            </div>

            {reopenedTasks.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-500">
                No reopened tasks in this range. 🎉
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {reopenedTasks.map((task) => {
                  const reworkShare = task.minutes > 0 ? (task.reopenMinutes / task.minutes) * 100 : 0;

                  return (
                    <li key={task.taskId}>
                      <details className="group">
                        <summary className="flex cursor-pointer list-none flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-medium text-slate-950">
                              <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="m8 5 5 5-5 5" />
                              </svg>
                              <span className="truncate">{task.title}</span>
                            </p>
                            <p className="mt-0.5 pl-6 text-xs text-slate-500">
                              {task.client} · reopened {task.reopenCount}{" "}
                              {task.reopenCount === 1 ? "time" : "times"}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 pl-6 sm:pl-0">
                            <div className="w-40">
                              {/* First pass vs rework, the same split the charts use. */}
                              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full bg-[#770FC2]" style={{ width: `${100 - reworkShare}%` }} />
                                <div className="h-full border-l-2 border-white bg-[#EB6834]" style={{ width: `${reworkShare}%` }} />
                              </div>
                              <p className="mt-1 flex justify-between text-[11px] tabular-nums text-slate-500">
                                <span>{formatDuration(task.originalMinutes)} first</span>
                                <span>{formatDuration(task.reopenMinutes)} rework</span>
                              </p>
                            </div>
                            <p className="w-16 text-right text-sm font-semibold tabular-nums text-slate-950">
                              {formatDuration(task.minutes)}
                            </p>
                          </div>
                        </summary>

                        {task.cycles.length > 0 ? (
                          <ol className="grid gap-3 bg-slate-50/60 px-5 pb-4 pl-11 pt-1">
                            {task.cycles.map((cycle) => {
                              const sentBack = reasons[`${task.taskId}:${cycle.cycle}`];

                              return (
                                <li key={cycle.cycle} className="rounded-lg border border-slate-200 bg-white p-3">
                                  <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-800">
                                    <span className="rounded bg-[#F3E8FF] px-1.5 py-0.5 text-[#770FC2]">
                                      Reopen {cycle.cycle}
                                    </span>
                                    {formatDuration(cycle.minutes)}
                                    {sentBack ? (
                                      <span className="font-normal text-slate-500">sent back by {sentBack.by}</span>
                                    ) : null}
                                  </p>
                                  {sentBack?.reason ? (
                                    <p className="mt-2 whitespace-pre-line break-words border-l-2 border-[#A05DD0]/50 pl-2 text-xs italic text-slate-600">
                                      {sentBack.reason}
                                    </p>
                                  ) : null}
                                  <ul className="mt-2 grid gap-1">
                                    {cycle.notes.map((entry) => (
                                      <li key={entry.id} className="whitespace-pre-line break-words text-xs text-slate-600">
                                        <span className="font-medium text-slate-800">{entry.personName}</span>{" "}
                                        · {formatDuration(entry.minutes)}
                                        {entry.note ? ` — ${entry.note}` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                </li>
                              );
                            })}
                          </ol>
                        ) : (
                          <p className="px-5 pb-4 pl-11 text-xs text-slate-500">
                            No rework logged in this range.
                          </p>
                        )}
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* On the employee tab the ranking already is the per-person total. */}
          {view !== "employee" && byPerson.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-950">Team totals</h2>
              <p className="mt-0.5 text-xs text-slate-500">Hours per person in this slice</p>
              <ul className="mt-4 grid gap-3">
                {byPerson.map((person) => {
                  const share = kpis.total > 0 ? (person.minutes / kpis.total) * 100 : 0;

                  return (
                    <li key={person.userId}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-slate-800">{person.name}</span>
                        <span className="shrink-0 tabular-nums text-slate-600">
                          {formatDuration(person.minutes)}
                          <span className="ml-2 text-xs text-slate-400">{Math.round(share)}%</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EDE3F7]">
                        <div className="h-full rounded-full bg-[#770FC2]" style={{ width: `${share}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}
