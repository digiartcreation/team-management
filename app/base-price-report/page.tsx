import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MonthFilter from "@/components/attendance/MonthFilter";
import BasePriceCharts from "@/components/basePriceReport/BasePriceCharts";
import { monthKeyOf, monthLabel, monthRange, monthsBetween } from "@/lib/attendance";
import {
  buildBasePriceReport,
  ratioBand,
  roundRatio,
  type TaskRow,
} from "@/lib/basePriceReport";
import { toServiceMapping } from "@/lib/clientServices";
import { formatDuration } from "@/lib/duration";
import { officeDate } from "@/lib/officeTime";
import { INTERNAL_LABEL } from "@/lib/reports";
import { formatInr, formatPaymentTerms } from "@/lib/services";

type BasePriceReportPageProps = {
  searchParams: Promise<{ month?: string }>;
};

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

  // The filter offers every month from the first logged hour to this one, and
  // opens on this month.
  const currentMonth = monthKeyOf(officeDate(new Date()));
  const earliest = await prisma.taskTimeLog.findFirst({
    orderBy: { date: "asc" },
    select: { date: true },
  });
  const earliestMonth = earliest ? monthKeyOf(earliest.date) : currentMonth;
  const months = monthsBetween(
    earliestMonth < currentMonth ? earliestMonth : currentMonth,
    currentMonth
  );
  const { month } = await searchParams;
  const selectedMonth = month && months.includes(month) ? month : currentMonth;

  const logs = await prisma.taskTimeLog.findMany({
    where: { date: monthRange(selectedMonth) },
    select: {
      minutes: true,
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
  });

  const clientIds = [
    ...new Set(logs.flatMap((log) => (log.task.client ? [log.task.client.id] : []))),
  ];

  // A package or a per-count task can be worked over several months, so the
  // month's share needs every hour ever logged on those clients' tasks.
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
  const taskMinutes =
    clientTasks.length > 0
      ? await prisma.taskTimeLog.groupBy({
          by: ["taskId"],
          where: { taskId: { in: clientTasks.map((task) => task.id) } },
          _sum: { minutes: true },
        })
      : [];
  const minutesByTask = new Map(
    taskMinutes.map((row) => [row.taskId, row._sum.minutes ?? 0])
  );

  const report = buildBasePriceReport({
    logs: logs.map((log) => ({
      minutes: log.minutes,
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
    history: clientTasks.map((task) => ({
      taskId: task.id,
      clientId: task.clientId,
      clientWork: task.clientWork,
      minutes: minutesByTask.get(task.id) ?? 0,
    })),
  });
  const { totals, leftOut, internal } = report;
  const label = monthLabel(selectedMonth);

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
              Base Price Report
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
              Income vs Work Effort
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{label}</span>
              <span>Income {formatInr(totals.income)}</span>
              <span>Work effort {formatInr(totals.effort)}</span>
              {totals.ratio === null ? null : (
                <span className="flex items-center gap-2">
                  Ratio
                  <span className="font-semibold text-slate-950">
                    {roundRatio(totals.ratio).toFixed(2)}
                  </span>
                  <BandChip ratio={totals.ratio} />
                </span>
              )}
            </p>
          </div>
          <MonthFilter
            months={months.map((key) => ({ value: key, label: monthLabel(key) }))}
            selected={selectedMonth}
            path="/base-price-report"
          />
        </header>

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
                No time logged in {label}.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Hours logged on tasks this month will be priced here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
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
                      {label} total · {plural(totals.tasks, "task")} counted
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
