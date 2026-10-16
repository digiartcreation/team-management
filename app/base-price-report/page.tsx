import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import BasePriceCharts from "@/components/basePriceReport/BasePriceCharts";
import {
  buildBasePriceReport,
  ratioBand,
  roundRatio,
  type TaskRow,
} from "@/lib/basePriceReport";
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
import { formatInr, formatPaymentTerms } from "@/lib/services";

type ReportFilters = {
  from?: string;
  to?: string;
  clientId?: string;
  userId?: string;
  service?: string;
};

type BasePriceReportPageProps = {
  searchParams: Promise<ReportFilters>;
};

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

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function decimal(value: { toString(): string } | null) {
  return value === null ? null : Number(value.toString());
}

function BandChip({ ratio }: { ratio: number }) {
  const band = ratioBand(ratio);

  return (
    <span
      title={band.label}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800"
    >
      <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: band.color }} />
      {band.colorName}
    </span>
  );
}

function RatioCell({ row }: { row: TaskRow }) {
  if (row.status === "issue") {
    return (
      <ul className="flex flex-col gap-1">
        {row.issues.map((issue) => (
          <li
            key={issue}
            className="w-fit rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200"
          >
            {issue}
          </li>
        ))}
      </ul>
    );
  }

  if (row.status === "internal") {
    return <span className="text-xs text-slate-500">Not billed</span>;
  }

  if (row.status === "included") {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        Included · cost only
      </span>
    );
  }

  return row.ratio === null ? (
    <span className="text-slate-400">—</span>
  ) : (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span className="font-semibold text-slate-950">{roundRatio(row.ratio).toFixed(2)}</span>
      <BandChip ratio={row.ratio} />
    </span>
  );
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
      ...(to && filters.to ? { lte: endOfDay(filters.to) } : {}),
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
  const { totals, leftOut, internal } = report;

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
  const presets = datePresets(todayUtcMidnight());
  const activePreset = presets.find(
    (preset) => preset.from === filters.from && preset.to === filters.to
  );

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#770FC2]">
              Base Price Report
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold text-slate-950 sm:text-3xl">
              Income vs Work Effort
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
          <dl className="flex flex-wrap items-end gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500">Income</dt>
              <dd className="text-lg font-semibold text-slate-950 tabular-nums">
                {formatInr(totals.income)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Work effort</dt>
              <dd className="text-lg font-semibold text-slate-950 tabular-nums">
                {formatInr(totals.effort)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Ratio</dt>
              <dd className="flex items-center gap-2 text-lg font-semibold text-slate-950 tabular-nums">
                {totals.ratio === null ? (
                  "—"
                ) : (
                  <>
                    {roundRatio(totals.ratio).toFixed(2)}
                    <BandChip ratio={totals.ratio} />
                  </>
                )}
              </dd>
            </div>
          </dl>
        </header>

        {/* Quick ranges */}
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

        {/* Filters: one row that scopes everything below */}
        <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
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
              href={reportHref({})}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Reset
            </Link>
          </div>
        </form>

        {leftOut.tasks > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">
              {plural(leftOut.tasks, "task")} ({formatDuration(leftOut.minutes)}) left
              out of the totals
            </p>
            <p className="mt-1 text-amber-800">
              Each is missing a price or a payment, named on its row below. Most
              often the employee has no domain or designation on the Employees
              page, or there is no rate for it on the Base Price page.
            </p>
          </div>
        ) : null}

        <BasePriceCharts clients={report.clients} />

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-950">
              Task-by-task calculation
            </h2>
            <p className="text-xs text-slate-500">
              Effort = hours × base price for the task&apos;s service and the
              employee&apos;s domain and designation
              {internal.tasks > 0
                ? ` · ${plural(internal.tasks, "internal task")} (${formatDuration(internal.minutes)}) not billed`
                : ""}
            </p>
          </div>

          {report.rows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No time logged for these filters.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Choose another date range, client, service or employee.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-275 text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Task · client</th>
                    <th className="px-4 py-3 font-semibold">Service · payment</th>
                    <th className="px-4 py-3 font-semibold">Income rule</th>
                    <th className="px-4 py-3 text-right font-semibold">Income</th>
                    <th className="px-4 py-3 font-semibold">Employee · base price</th>
                    <th className="px-4 py-3 text-right font-semibold">Hours</th>
                    <th className="px-4 py-3 text-right font-semibold">Work effort</th>
                    <th className="px-4 py-3 font-semibold">Ratio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 tabular-nums">
                  {report.rows.map((row) => {
                    const muted = row.status === "internal" || row.status === "issue";

                    return (
                      <tr key={row.taskId} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className={`font-medium ${muted ? "text-slate-600" : "text-slate-950"}`}>
                            {row.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {row.clientName ?? INTERNAL_LABEL}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-800">{row.work ?? "—"}</p>
                          {row.payment ? (
                            <p className="text-xs text-slate-500">
                              {formatPaymentTerms(row.payment)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-slate-700">
                          {row.incomeRule ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-slate-900">
                          {row.income === null ? "—" : formatInr(row.income)}
                        </td>
                        <td className="px-4 py-3">
                          <ul className="flex flex-col gap-1">
                            {row.employees.map((line) => (
                              <li key={line.userId}>
                                <p className="text-slate-800">
                                  {line.name}
                                  {line.designation ? (
                                    <span className="text-slate-500"> · {line.designation}</span>
                                  ) : null}
                                </p>
                                <p
                                  className={`text-xs ${
                                    line.rate === null && row.status !== "internal"
                                      ? "text-amber-700"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {formatDuration(line.minutes)}
                                  {line.rate === null
                                    ? row.status === "internal"
                                      ? ""
                                      : " · no base price"
                                    : ` × ${formatInr(line.rate)}/hr`}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-slate-700">
                          {formatDuration(row.minutes)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-slate-900">
                          {row.effort === null ? "—" : formatInr(row.effort)}
                        </td>
                        <td className="px-4 py-3">
                          <RatioCell row={row} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-950 tabular-nums">
                  <tr>
                    <td className="px-4 py-3" colSpan={3}>
                      Total · {plural(totals.tasks, "task")} counted
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {formatInr(totals.income)}
                    </td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {formatDuration(totals.minutes)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {formatInr(totals.effort)}
                    </td>
                    <td className="px-4 py-3">
                      {totals.ratio === null ? null : (
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          {roundRatio(totals.ratio).toFixed(2)}
                          <BandChip ratio={totals.ratio} />
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
