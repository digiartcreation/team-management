import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ServiceCountExport from "@/components/serviceCounts/ServiceCountExport";
import { monthKeyOf, monthLabel, monthRange, monthsBetween } from "@/lib/attendance";
import { toServiceMapping } from "@/lib/clientServices";
import { formatOfficeDate, officeDate, officeInstant } from "@/lib/officeTime";
import { datePresets } from "@/lib/reportAnalytics";
import { describeRange, parseDateInput, todayUtcMidnight } from "@/lib/reportFilters";
import {
  COUNTED_SERVICES,
  buildServiceCounts,
  formatCount,
  quantityLabel,
  rateLabel,
  tasksLabel,
  type CountedService,
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

/** The dot each service is marked with. */
const SERVICE_DOT: Record<CountedService, string> = {
  "Video Editing": "bg-[#770FC2]",
  "Poster Design": "bg-amber-500",
  "Digital Marketing": "bg-sky-500",
};

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

function decimal(value: { toString(): string } | null) {
  return value === null ? null : Number(value.toString());
}

/** What one task adds to its line: "weightage 2", "5 posters", "₹50,000". */
function taskQuantity(service: CountedService, quantity: number) {
  if (service === "Video Editing") return `weightage ${formatCount(quantity)}`;
  if (service === "Poster Design") return `${quantity} ${quantity === 1 ? "poster" : "posters"}`;
  return formatInr(quantity);
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

  // Completions are moments, so the range is the office's days, midnight to
  // midnight.
  const [completedTasks, firstCompleted] = await Promise.all([
    prisma.task.findMany({
      where: {
        clientId: { not: null },
        completedAt: {
          not: null,
          ...(from ? { gte: officeInstant(from, 0) } : {}),
          ...(to ? { lt: officeInstant(new Date(to.getTime() + DAY_MS), 0) } : {}),
        },
      },
      select: {
        id: true,
        title: true,
        clientWork: true,
        videoWeightage: true,
        posterCount: true,
        digitalMarketingAmount: true,
        completedAt: true,
        client: { select: { id: true, name: true } },
      },
    }),
    prisma.task.aggregate({
      where: { clientId: { not: null } },
      _min: { completedAt: true },
    }),
  ]);

  const clientIds = [
    ...new Set(completedTasks.flatMap((task) => (task.client ? [task.client.id] : []))),
  ];
  const mappingRows = await prisma.clientService.findMany({
    where: { clientId: { in: clientIds }, service: { in: [...COUNTED_SERVICES] } },
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
  });

  const report = buildServiceCounts(
    completedTasks.flatMap((task) =>
      task.client && task.completedAt
        ? [
            {
              id: task.id,
              title: task.title,
              clientId: task.client.id,
              clientName: task.client.name,
              clientWork: task.clientWork,
              videoWeightage: decimal(task.videoWeightage),
              posterCount: task.posterCount,
              digitalMarketingAmount: decimal(task.digitalMarketingAmount),
              completedAt: task.completedAt.toISOString(),
            },
          ]
        : []
    ),
    mappingRows.map((row) => ({ clientId: row.clientId, ...toServiceMapping(row) }))
  );

  // Every month with a completion in it, newest first.
  const currentMonth = monthKeyOf(today);
  const firstMonth = firstCompleted._min.completedAt
    ? [monthKeyOf(officeDate(firstCompleted._min.completedAt)), currentMonth].sort()[0]
    : currentMonth;
  const monthOptions = monthsBetween(firstMonth, currentMonth);

  const scope = allTime ? "All time" : month ? monthLabel(month) : describeRange(from, to);
  const fileStem = `services-count-${
    allTime ? "all-time" : month ? month : [dates.from, dates.to].filter(Boolean).join("-to-")
  }`;
  const activePreset = allTime
    ? "All time"
    : presets.find((preset) => preset.from === dates.from && preset.to === dates.to)?.label;

  const unpriced = report.clients.some((client) =>
    client.lines.some((line) => line.amount === null)
  );
  const notes = [
    "Counts are client tasks completed in the period, by the date each was first completed. Videos count by weightage, the number of videos each bills as; the brackets give the number of tasks.",
    "Rates come from each client's services on Client Management: per-count rate for videos and posters, percentage of the amount for Digital Marketing.",
    ...(unpriced
      ? [
          "A service billed another way (a package) or with no rate set shows its terms instead of an amount, and is left out of the totals.",
        ]
      : []),
    ...(report.postersWithoutCount > 0
      ? [
          `${report.postersWithoutCount} Poster Design ${
            report.postersWithoutCount === 1 ? "task" : "tasks"
          } completed in this period ${
            report.postersWithoutCount === 1 ? "has" : "have"
          } no poster count saved and ${report.postersWithoutCount === 1 ? "is" : "are"} not counted.`,
        ]
      : []),
  ];

  const { byService } = report;
  const tiles = [
    {
      label: "Videos",
      value: formatCount(byService["Video Editing"].quantity),
      detail: tasksLabel(byService["Video Editing"].tasks),
    },
    {
      label: "Posters",
      value: String(byService["Poster Design"].quantity),
      detail: tasksLabel(byService["Poster Design"].tasks),
    },
    {
      label: "DM amount",
      value: formatInr(byService["Digital Marketing"].quantity),
      detail: tasksLabel(byService["Digital Marketing"].tasks),
    },
    {
      label: "Total amount",
      value: formatInr(report.total),
      detail: `${report.clients.length} ${report.clients.length === 1 ? "client" : "clients"}`,
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
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className={labelClass}>{tile.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{tile.value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{tile.detail}</p>
            </div>
          ))}
        </section>

        {/* Per client: count × rate = amount */}
        {report.clients.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No videos, posters or Digital Marketing work was completed for a client in this period.
          </p>
        ) : (
          <div className="grid gap-4">
            {report.clients.map((client) => (
              <section
                key={client.clientId}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
                  <h2 className="min-w-0 truncate text-base font-semibold text-slate-950">
                    {client.name}
                  </h2>
                  <p className="shrink-0 text-sm text-slate-500">
                    Total{" "}
                    <span className="text-base font-semibold tabular-nums text-[#770FC2]">
                      {formatInr(client.total)}
                    </span>
                  </p>
                </div>

                <ul className="divide-y divide-slate-100">
                  {client.lines.map((line) => (
                    <li key={line.service}>
                      <details className="group">
                        <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 transition hover:bg-[#FBF7FF] sm:grid-cols-[11rem_minmax(0,1fr)_7rem] [&::-webkit-details-marker]:hidden">
                          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800">
                            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${SERVICE_DOT[line.service]}`} />
                            <span className="truncate">{line.service}</span>
                            <svg
                              aria-hidden
                              viewBox="0 0 20 20"
                              className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-open:rotate-90"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="m8 5 5 5-5 5" />
                            </svg>
                          </span>
                          <span className="order-3 col-span-2 text-sm tabular-nums text-slate-700 sm:order-none sm:col-span-1">
                            <span className="font-semibold text-slate-950">
                              {quantityLabel(line.service, line.quantity)}
                            </span>{" "}
                            <span className="text-slate-500">({tasksLabel(line.tasks.length)})</span>{" "}
                            <span className="text-slate-400">×</span>{" "}
                            <span className={line.amount === null ? "text-amber-700" : ""}>
                              {rateLabel(line)}
                            </span>
                          </span>
                          <span className="text-right text-sm font-semibold tabular-nums text-slate-950">
                            {line.amount === null ? (
                              <span className="text-slate-400">–</span>
                            ) : (
                              <>= {formatInr(line.amount)}</>
                            )}
                          </span>
                        </summary>

                        <ul className="grid gap-1 border-t border-slate-100 bg-slate-50 px-5 py-2.5">
                          {line.tasks.map((task) => (
                            <li
                              key={task.id}
                              className="flex items-baseline justify-between gap-3 text-xs"
                            >
                              <span className="min-w-0 truncate text-slate-700">{task.title}</span>
                              <span className="shrink-0 tabular-nums text-slate-500">
                                {taskQuantity(line.service, task.quantity)} ·{" "}
                                {formatOfficeDate(task.completedAt)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <div className="flex items-center justify-between rounded-xl border border-[#A05DD0]/40 bg-[#F8F7FB] px-5 py-3">
              <span className="text-sm font-semibold text-[#770FC2]">Total · {scope}</span>
              <span className="text-lg font-semibold tabular-nums text-[#770FC2]">
                {formatInr(report.total)}
              </span>
            </div>
          </div>
        )}

        <ul className="grid gap-1 text-xs text-slate-500">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </DashboardLayout>
  );
}
