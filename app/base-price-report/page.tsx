import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import BasePriceCharts, { type GroupNoun } from "@/components/basePriceReport/BasePriceCharts";
import CalculationFlow from "@/components/basePriceReport/CalculationFlow";
import { GroupSummaryTable, ReportKpis } from "@/components/basePriceReport/ReportSummary";
import { buildBasePriceReport, type FixPlace } from "@/lib/basePriceReport";
import { toServiceMapping } from "@/lib/clientServices";
import { formatDuration } from "@/lib/duration";
import { datePresets } from "@/lib/reportAnalytics";
import {
  UNMAPPED_SERVICE,
  describeRange,
  endOfDay,
  parseDateInput,
  todayUtcMidnight,
} from "@/lib/reportFilters";
import { INTERNAL_LABEL, UNMAPPED_SERVICE_LABEL, serviceNameOf } from "@/lib/reports";

type ReportFilters = {
  view?: string;
  from?: string;
  to?: string;
  clientId?: string;
  userId?: string;
  service?: string;
};

type BasePriceReportPageProps = {
  searchParams: Promise<ReportFilters>;
};

const VIEWS: { key: GroupNoun; tab: string }[] = [
  { key: "client", tab: "Client wise" },
  { key: "service", tab: "Service wise" },
];

/** Keeps the current filters on a link, dropping the ones left blank. */
function reportHref(filters: ReportFilters) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();

  return query ? `/base-price-report?${query}` : "/base-price-report";
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

const labelClass = "text-xs font-medium uppercase tracking-wide text-slate-500";

/** Where the banner sends people to fix each kind of gap. */
const FIX_PAGES: Record<FixPlace, { href: string; label: string } | null> = {
  // Tasks and clients are fixed one at a time, from the rows below.
  task: null,
  client: null,
  employee: { href: "/employees", label: "Employees" },
  basePrice: { href: "/base-prices", label: "Base Price" },
};

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function decimal(value: { toString(): string } | null) {
  return value === null ? null : Number(value.toString());
}

export default async function BasePriceReportPage({
  searchParams,
}: BasePriceReportPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    isSuperAdmin?: boolean;
  };

  if (!sessionUser.isSuperAdmin) {
    redirect("/");
  }

  const filters = await searchParams;
  const view: GroupNoun = filters.view === "service" ? "service" : "client";
  // With no dates chosen the report opens on this month.
  const presets = datePresets(todayUtcMidnight());
  const thisMonth = presets.find((preset) => preset.label === "This month")!;
  const dates: { from?: string; to?: string } =
    filters.from || filters.to ? { from: filters.from, to: filters.to } : thisMonth;
  const from = parseDateInput(dates.from);
  const to = parseDateInput(dates.to);

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

  const where: Prisma.TaskTimeLogWhereInput = {};
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
    where.task = taskFilter;
  }

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      // Inclusive of the chosen day, whatever time the entry carries.
      ...(to && dates.to ? { lte: endOfDay(dates.to) } : {}),
    };
  }

  const [logs, clientOptions, userOptions] = await Promise.all([
    prisma.taskTimeLog.findMany({
      where,
      select: {
        minutes: true,
        date: true,
        user: { select: { id: true, name: true, sector: true, designation: true } },
        task: {
          select: {
            id: true,
            title: true,
            clientWork: true,
            videoWeightage: true,
            posterCount: true,
            digitalMarketingAmount: true,
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
  ]);

  const clientIds = [
    ...new Set(logs.flatMap((log) => (log.task.client ? [log.task.client.id] : []))),
  ];

  // A package or a per-count task pays for every hour logged on it, inside the
  // filters or not, so its share needs the clients' full history by day.
  const [mappingRows, basePriceRows, clientTasks] = await Promise.all([
    prisma.clientService.findMany({
      where: { clientId: { in: clientIds } },
      select: {
        clientId: true,
        service: true,
        focus: true,
        paymentType: true,
        percentage: true,
        packageAmount: true,
        perUnitAmount: true,
        billingCycle: true,
      },
    }),
    prisma.basePrice.findMany({
      select: { service: true, sector: true, designation: true, basePrice: true },
    }),
    prisma.task.findMany({
      where: { clientId: { in: clientIds } },
      select: { id: true, clientId: true, clientWork: true },
    }),
  ]);
  const dailyMinutes =
    clientTasks.length > 0
      ? await prisma.taskTimeLog.groupBy({
          by: ["taskId", "date"],
          where: { taskId: { in: clientTasks.map((task) => task.id) } },
          _sum: { minutes: true },
        })
      : [];
  const tasksById = new Map(clientTasks.map((task) => [task.id, task]));

  const report = buildBasePriceReport({
    logs: logs.map((log) => ({
      minutes: log.minutes,
      date: log.date,
      user: log.user,
      task: {
        ...log.task,
        videoWeightage: decimal(log.task.videoWeightage),
        digitalMarketingAmount: decimal(log.task.digitalMarketingAmount),
      },
    })),
    mappings: mappingRows.map((row) => ({
      clientId: row.clientId,
      ...toServiceMapping(row),
    })),
    basePrices: basePriceRows.map((row) => ({
      ...row,
      basePrice: row.basePrice.toNumber(),
    })),
    history: dailyMinutes.map((row) => ({
      taskId: row.taskId,
      clientId: tasksById.get(row.taskId)?.clientId ?? null,
      clientWork: tasksById.get(row.taskId)?.clientWork ?? null,
      date: row.date,
      minutes: row._sum.minutes ?? 0,
    })),
  });
  const { leftOut } = report;
  const groups = view === "client" ? report.byClient : report.byService;

  // What keeps tasks out of the totals, most common first.
  const gaps = new Map<string, { fix: FixPlace; tasks: number }>();

  for (const row of report.rows) {
    for (const issue of row.issues) {
      const gap = gaps.get(issue.message) ?? { fix: issue.fix, tasks: 0 };
      gap.tasks += 1;
      gaps.set(issue.message, gap);
    }
  }

  const gapList = [...gaps.entries()].sort((a, b) => b[1].tasks - a[1].tasks);

  // A one-line description of the slice, as the Reports page writes it.
  const scopeParts = [describeRange(from, to)];

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
  const activePreset = presets.find(
    (preset) => preset.from === dates.from && preset.to === dates.to
  );

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Header */}
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#770FC2]">
            Base Price Report
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold text-slate-950 sm:text-3xl">
            Income vs Work Effort {view === "client" ? "by Client" : "by Service"}
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
        </header>

        {/* View tabs + quick ranges */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {VIEWS.map((option) => (
              <Link
                key={option.key}
                href={reportHref({ ...filters, view: option.key })}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  option.key === view
                    ? "bg-[#770FC2] text-white shadow-sm"
                    : "text-slate-600 hover:bg-[#F3E8FF] hover:text-[#770FC2]"
                }`}
              >
                {option.tab}
              </Link>
            ))}
          </nav>

          <div className="flex flex-wrap gap-1.5">
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
            <input name="from" type="date" defaultValue={dates.from ?? ""} className={inputClass} />
          </label>

          <label className="grid gap-1.5">
            <span className={labelClass}>To</span>
            <input name="to" type="date" defaultValue={dates.to ?? ""} className={inputClass} />
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

        <ReportKpis report={report} />

        {leftOut.tasks > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <p className="font-semibold">
              {plural(leftOut.tasks, "task")} ({formatDuration(leftOut.minutes)}) left out of
              the totals
            </p>
            <ul className="mt-2 grid gap-1.5 md:grid-cols-2">
              {gapList.map(([message, gap]) => {
                const page = FIX_PAGES[gap.fix];

                return (
                  <li key={message} className="flex flex-wrap items-baseline gap-x-2 text-amber-800">
                    <span className="font-semibold tabular-nums">{gap.tasks}×</span>
                    <span>{message}</span>
                    {page ? (
                      <Link href={page.href} className="font-semibold text-[#770FC2] hover:underline">
                        {page.label} page →
                      </Link>
                    ) : (
                      <span className="text-amber-700">· fix from the task below</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <BasePriceCharts groups={groups} noun={view} />

        <GroupSummaryTable groups={groups} noun={view} totals={report.totals} />

        <CalculationFlow rows={report.rows} groups={groups} noun={view} />
      </div>
    </DashboardLayout>
  );
}
