import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ServiceCountExport from "@/components/serviceCounts/ServiceCountExport";
import { monthKeyOf, monthLabel, monthRange, monthsBetween } from "@/lib/attendance";
import { loadBasePriceReport } from "@/lib/basePriceReportData";
import { formatDuration } from "@/lib/duration";
import { officeDate, officeInstant } from "@/lib/officeTime";
import { datePresets } from "@/lib/reportAnalytics";
import {
  describeRange,
  endOfDay,
  parseDateInput,
  todayUtcMidnight,
} from "@/lib/reportFilters";
import {
  buildServiceCounts,
  formatCount,
  formatProfitPercent,
  profitBand,
} from "@/lib/serviceCounts";
import { formatInr } from "@/lib/services";

type ServiceCountFilters = {
  /** "all" for all time. */
  period?: string;
  /** "2026-10": one whole month. */
  month?: string;
  from?: string;
  to?: string;
};

type ServicesCountPageProps = {
  searchParams: Promise<ServiceCountFilters>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

const labelClass = "text-xs font-medium uppercase tracking-wide text-slate-500";

function servicesCountHref(filters: ServiceCountFilters) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();

  return query ? `/services-count?${query}` : "/services-count";
}

function isMonthKey(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function decimal(value: { toString(): string } | null) {
  return value === null ? null : Number(value.toString());
}

/** A profit with its Base Price Report colour band, never colour alone. */
function ProfitValue({ percent }: { percent: number | null }) {
  if (percent === null) {
    return (
      <span title="No billed work to set the cost against" className="text-slate-400">
        –
      </span>
    );
  }

  const band = profitBand(percent);

  return (
    <span
      title={`${band.label} · ratio ${band.range}`}
      className="inline-flex items-center justify-end gap-2 whitespace-nowrap"
    >
      <span className="font-semibold tabular-nums text-slate-950">
        {formatProfitPercent(percent)}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
        <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: band.color }} />
        {band.label}
      </span>
    </span>
  );
}

export default async function ServicesCountPage({
  searchParams,
}: ServicesCountPageProps) {
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
  const today = todayUtcMidnight();
  const presets = datePresets(today);
  const thisMonth = presets.find((preset) => preset.label === "This month")!;

  // All time, one month, a range, or -- with nothing chosen -- this month.
  const allTime = filters.period === "all";
  const month = !allTime && isMonthKey(filters.month) ? filters.month : null;
  let dates: { from?: string; to?: string };

  if (allTime) {
    dates = {};
  } else if (month) {
    const { gte, lt } = monthRange(month);
    dates = {
      from: gte.toISOString().slice(0, 10),
      to: new Date(lt.getTime() - DAY_MS).toISOString().slice(0, 10),
    };
  } else if (filters.from || filters.to) {
    dates = { from: filters.from, to: filters.to };
  } else {
    dates = thisMonth;
  }

  const from = parseDateInput(dates.from);
  const to = parseDateInput(dates.to);

  // Hours are stored against their work day; completions are moments, so the
  // range is the office's days, midnight to midnight.
  const logWhere = {
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: from } : {}),
            ...(to && dates.to ? { lte: endOfDay(dates.to) } : {}),
          },
        }
      : {}),
  };
  const completedWithin = {
    not: null,
    ...(from ? { gte: officeInstant(from, 0) } : {}),
    ...(to ? { lt: officeInstant(new Date(to.getTime() + DAY_MS), 0) } : {}),
  };

  const [completedTasks, priced, firstCompleted, firstLogged] = await Promise.all([
    prisma.task.findMany({
      where: { clientId: { not: null }, completedAt: completedWithin },
      select: {
        clientWork: true,
        videoWeightage: true,
        posterCount: true,
        digitalMarketingAmount: true,
        client: { select: { id: true, name: true } },
      },
    }),
    loadBasePriceReport(logWhere),
    prisma.task.aggregate({
      where: { clientId: { not: null } },
      _min: { completedAt: true },
    }),
    prisma.taskTimeLog.aggregate({ _min: { date: true } }),
  ]);

  const report = buildServiceCounts(
    completedTasks.flatMap((task) =>
      task.client
        ? [
            {
              clientId: task.client.id,
              clientName: task.client.name,
              clientWork: task.clientWork,
              videoWeightage: decimal(task.videoWeightage),
              posterCount: task.posterCount,
              digitalMarketingAmount: decimal(task.digitalMarketingAmount),
            },
          ]
        : []
    ),
    priced.byClient
  );

  // Every month there is anything to show, newest first.
  const currentMonth = monthKeyOf(today);
  const firstMonth = [
    firstCompleted._min.completedAt ? monthKeyOf(officeDate(firstCompleted._min.completedAt)) : null,
    firstLogged._min.date ? monthKeyOf(firstLogged._min.date) : null,
    currentMonth,
  ]
    .filter((key): key is string => Boolean(key))
    .sort()[0];
  const monthOptions = monthsBetween(firstMonth, currentMonth);

  const scope = allTime ? "All time" : month ? monthLabel(month) : describeRange(from, to);
  const fileStem = `services-count-${
    allTime ? "all-time" : month ? month : [dates.from, dates.to].filter(Boolean).join("-to-")
  }`;
  const activePreset = allTime
    ? "All time"
    : presets.find((preset) => preset.from === dates.from && preset.to === dates.to)?.label;

  // The Base Price Report has no "all time", so that opens it from the first month.
  const pricingHref = `/base-price-report?${new URLSearchParams(
    allTime ? { from: `${firstMonth}-01` } : { from: dates.from ?? "", to: dates.to ?? "" }
  ).toString()}`;

  const notes = [
    "Videos, posters and DM amounts count client tasks completed in the period, by the date each was first completed. Video weightage is how many videos they bill as.",
    "Income and cost come from hours logged in the period, priced as on the Base Price Report: income from each client's service payment, cost from hours × base price. Profit % = (income - cost) ÷ cost.",
    ...(priced.leftOut.tasks > 0
      ? [
          `${plural(priced.leftOut.tasks, "task")} (${formatDuration(priced.leftOut.minutes)}) logged in this period are left out of income, cost and profit because their pricing data is missing.`,
        ]
      : []),
    ...(report.postersWithoutCount > 0
      ? [
          `${plural(report.postersWithoutCount, "Poster Design task")} completed in this period ${
            report.postersWithoutCount === 1 ? "has" : "have"
          } no poster count saved and add no posters.`,
        ]
      : []),
  ];

  const { totals } = report;
  const tiles = [
    {
      label: "Videos",
      value: String(totals.videos),
      detail:
        totals.videoWeightage !== totals.videos
          ? `Weightage ${formatCount(totals.videoWeightage)}`
          : "Video Editing tasks",
    },
    { label: "Posters", value: String(totals.posters), detail: "Poster Design" },
    { label: "DM amount", value: formatInr(totals.dmAmount), detail: "Digital Marketing" },
    {
      label: "Income vs cost",
      value: formatInr(totals.income),
      detail: `Cost ${formatInr(totals.cost)}`,
    },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#770FC2]">
              Services Count
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold text-slate-950 sm:text-3xl">
              Client services delivered
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
          <ServiceCountExport
            scope={scope}
            fileStem={fileStem}
            report={report}
            notes={notes}
          />
        </header>

        {/* Quick ranges. Plain links, a full page load like the forms below:
            in production a client-side hop that only changes the query string
            sometimes never finishes, leaving the old range on screen. */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "All time", href: servicesCountHref({ period: "all" }) },
            ...presets.map((preset) => ({
              label: preset.label,
              href: servicesCountHref({ from: preset.from, to: preset.to }),
            })),
          ].map((option) => (
            <a
              key={option.label}
              href={option.href}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                activePreset === option.label
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-600 ring-slate-200 hover:ring-[#A05DD0]"
              }`}
            >
              {option.label}
            </a>
          ))}
        </div>

        {/* A month, or any range */}
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] lg:items-end">
          <form className="flex items-end gap-2">
            <label className="grid flex-1 gap-1.5">
              <span className={labelClass}>Month</span>
              <select name="month" required defaultValue={month ?? ""} className={inputClass}>
                <option value="" disabled>
                  Choose a month
                </option>
                {monthOptions.map((key) => (
                  <option key={key} value={key}>
                    {monthLabel(key)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              View
            </button>
          </form>

          <form className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-1.5">
              <span className={labelClass}>From</span>
              <input
                name="from"
                type="date"
                defaultValue={month || allTime ? "" : (dates.from ?? "")}
                className={inputClass}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>To</span>
              <input
                name="to"
                type="date"
                defaultValue={month || allTime ? "" : (dates.to ?? "")}
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Apply
            </button>
          </form>

          <a
            href="/services-count"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Reset
          </a>
        </div>

        {/* Totals */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className={labelClass}>{tile.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{tile.value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{tile.detail}</p>
            </div>
          ))}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className={labelClass}>Profit</p>
            <div className="mt-1 text-2xl">
              {totals.profitPercent === null ? (
                <span className="font-semibold text-slate-400">–</span>
              ) : (
                <ProfitValue percent={totals.profitPercent} />
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatInr(totals.income - totals.cost)} on cost
            </p>
          </div>
        </section>

        {priced.leftOut.tasks > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <p className="font-semibold">
              {plural(priced.leftOut.tasks, "task")} ({formatDuration(priced.leftOut.minutes)}) left
              out of income, cost and profit
            </p>
            <p className="mt-1 text-amber-800">
              Their pricing data is missing (a client payment, a base price, or a field on the
              task).{" "}
              <Link href={pricingHref} className="font-semibold text-[#770FC2] hover:underline">
                See what to fix on the Base Price Report →
              </Link>
            </p>
          </div>
        ) : null}

        {/* Per client */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-950">By client</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {plural(report.rows.length, "client")} with work in this period.
            </p>
          </div>

          {report.rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Nothing was completed or logged for a client in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase">
                  <tr>
                    <th className="px-5 py-3">Client</th>
                    <th className="px-4 py-3 text-right">Videos</th>
                    <th className="px-4 py-3 text-right">Posters</th>
                    <th className="px-4 py-3 text-right">DM amount</th>
                    <th className="px-4 py-3 text-right">Income</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                    <th className="px-5 py-3 text-right">Profit %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.rows.map((row) => (
                    <tr key={row.clientId}>
                      <td className="px-5 py-3 font-medium text-slate-950">{row.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.videos}
                        {row.videoWeightage !== row.videos ? (
                          <span className="block text-xs text-slate-500">
                            weightage {formatCount(row.videoWeightage)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.posters}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.dmAmount > 0 ? formatInr(row.dmAmount) : <span className="text-slate-400">–</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.income === null ? <span className="text-slate-400">–</span> : formatInr(row.income)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.cost === null ? <span className="text-slate-400">–</span> : formatInr(row.cost)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <ProfitValue percent={row.profitPercent} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-[#A05DD0]/40 bg-[#F8F7FB] font-semibold">
                  <tr>
                    <td className="px-5 py-3 text-[#770FC2]">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {totals.videos}
                      {totals.videoWeightage !== totals.videos ? (
                        <span className="block text-xs font-normal text-slate-500">
                          weightage {formatCount(totals.videoWeightage)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{totals.posters}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatInr(totals.dmAmount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatInr(totals.income)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatInr(totals.cost)}</td>
                    <td className="px-5 py-3 text-right">
                      <ProfitValue percent={totals.profitPercent} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <ul className="grid gap-1 text-xs text-slate-500">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </DashboardLayout>
  );
}
