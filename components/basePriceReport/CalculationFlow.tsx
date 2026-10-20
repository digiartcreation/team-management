import Link from "next/link";
import { RatioScale, RatioValue } from "@/components/basePriceReport/RatioBand";
import type { GroupNoun } from "@/components/basePriceReport/BasePriceCharts";
import { monthLabel } from "@/lib/attendance";
import {
  countLabel,
  ratioBand,
  roundRatio,
  type FixPlace,
  type GroupTotal,
  type HoursShare,
  type IncomeBreakdown,
  type RowIssue,
  type TaskRow,
} from "@/lib/basePriceReport";
import { formatDuration } from "@/lib/duration";
import { INTERNAL_LABEL } from "@/lib/reports";
import { formatInr, formatPaymentTerms, formatPercentage } from "@/lib/services";

/** Task, work, hours, income, effort, ratio, chevron: shared by every row. */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.8fr)_5.5rem_7rem_7rem_11rem_1rem]";

function signedInr(amount: number) {
  return `${amount < 0 ? "−" : "+"}${formatInr(Math.abs(amount))}`;
}

function percentOf(share: HoursShare) {
  return Math.round((share.part / share.whole) * 100);
}

const FIX_LINKS: Record<FixPlace, string> = {
  task: "Edit task",
  client: "Edit client",
  employee: "Edit employee",
  basePrice: "Set base price",
};

function fixHref(issue: RowIssue, row: TaskRow) {
  switch (issue.fix) {
    case "task":
      return `/tasks/${row.taskId}/edit`;
    case "client":
      return row.clientId ? `/clients/${row.clientId}/edit` : "/clients";
    case "employee":
      return issue.userId ? `/employees/${issue.userId}/edit` : "/employees";
    case "basePrice":
      return "/base-prices/new";
  }
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

/** Points right when closed and down when open; the caller says which group. */
function Chevron({ className }: { className: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={`hidden h-4 w-4 shrink-0 transition md:block ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M7 4l6 6-6 6" />
    </svg>
  );
}

function Line({
  label,
  value,
  strong = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={strong ? "font-semibold text-slate-950" : "text-slate-500"}>{label}</span>
      <span className={`text-right tabular-nums ${strong ? "font-semibold text-slate-950" : "text-slate-800"}`}>
        {value}
      </span>
    </div>
  );
}

function StepCard({
  step,
  title,
  source,
  children,
  result,
}: {
  step: number;
  title: string;
  source: React.ReactNode;
  children: React.ReactNode;
  result: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#770FC2]">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#F3E8FF] text-[11px]">{step}</span>
          {title}
        </p>
        <p className="mt-1 text-xs text-slate-500">{source}</p>
      </div>
      <div className="flex-1 space-y-2 px-4 py-3 text-sm">{children}</div>
      <div className="rounded-b-lg border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-sm">{result}</div>
    </div>
  );
}

function ShareLines({
  full,
  share,
  minutes,
  of,
}: {
  full: number;
  share: HoursShare | null;
  /** The task's minutes in the report. */
  minutes: number;
  of: string;
}) {
  if (!share) {
    return (
      <p className="text-xs text-slate-500">
        All {formatDuration(minutes)} {of} are in this report, so the full amount counts.
      </p>
    );
  }

  return (
    <>
      <Line
        label="Hours in this report"
        value={`${formatDuration(share.part)} of ${formatDuration(share.whole)}`}
      />
      <p className="text-xs text-slate-500">
        The amount pays for all {formatDuration(share.whole)} {of}, so this report takes{" "}
        {percentOf(share)}%: {formatInr(full)} × {formatDuration(share.part)} ÷{" "}
        {formatDuration(share.whole)}.
      </p>
    </>
  );
}

function IncomeLines({ breakdown, row }: { breakdown: IncomeBreakdown; row: TaskRow }) {
  const scope = `logged on ${row.service} for ${row.clientName}`;

  switch (breakdown.kind) {
    case "included":
      return (
        <p className="text-slate-600">
          Client Management comes with every client and is not billed, so it
          brings no income. Its effort still counts as cost.
        </p>
      );
    case "perCount": {
      const unit =
        breakdown.unit === "poster" ? "poster" : breakdown.unit === "video" ? "video" : "item";

      return (
        <>
          <Line
            label={breakdown.unit === "video" ? "Video weightage" : "Count"}
            value={
              breakdown.unit === "video"
                ? `${breakdown.count} (bills as ${breakdown.count} ${breakdown.count === 1 ? "video" : "videos"})`
                : countLabel(breakdown.unit, breakdown.count)
            }
          />
          <Line label={`Rate per ${unit}`} value={formatInr(breakdown.rate)} />
          <Line
            label="Full amount"
            value={`${breakdown.count} × ${formatInr(breakdown.rate)} = ${formatInr(breakdown.full)}`}
          />
          <ShareLines full={breakdown.full} share={breakdown.share} minutes={row.minutes} of="logged on the task" />
        </>
      );
    }
    case "percentage":
      return (
        <>
          <Line label="Digital Marketing amount on the task" value={formatInr(breakdown.base)} />
          <Line label="Client's percentage" value={formatPercentage(breakdown.percentage)} />
          <Line
            label="Full amount"
            value={`${formatInr(breakdown.base)} × ${formatPercentage(breakdown.percentage)} = ${formatInr(breakdown.full)}`}
          />
          <ShareLines full={breakdown.full} share={breakdown.share} minutes={row.minutes} of="logged on the task" />
        </>
      );
    case "oneTime":
      return (
        <>
          <Line label="One-time package" value={formatInr(breakdown.amount)} />
          <ShareLines full={breakdown.amount} share={breakdown.share} minutes={row.minutes} of={`ever ${scope}`} />
        </>
      );
    case "monthly":
      return (
        <>
          <Line label="Monthly package" value={formatInr(breakdown.amount)} />
          {breakdown.months.map((month) => (
            <div key={month.month} className="rounded-md bg-slate-50 px-3 py-2">
              <Line label={monthLabel(month.month)} value={formatInr(month.income)} />
              <p className="mt-1 text-xs text-slate-500">
                {month.part >= month.whole
                  ? `All ${formatDuration(month.whole)} ${scope} that month, so the full package.`
                  : `${formatDuration(month.part)} of the ${formatDuration(month.whole)} ${scope} that month: ${formatInr(breakdown.amount)} × ${formatDuration(month.part)} ÷ ${formatDuration(month.whole)}.`}
              </p>
            </div>
          ))}
        </>
      );
  }
}

function IssueList({ row }: { row: TaskRow }) {
  return (
    <ul className="space-y-2">
      {row.issues.map((issue) => (
        <li
          key={issue.message}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200"
        >
          <span className="font-medium">{issue.message}</span>
          <Link
            href={fixHref(issue, row)}
            className="rounded bg-white px-2 py-0.5 font-semibold text-[#770FC2] ring-1 ring-amber-200 hover:bg-[#F3E8FF]"
          >
            {FIX_LINKS[issue.fix]} →
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* One task                                                             */
/* ------------------------------------------------------------------ */

function StatusCell({ row }: { row: TaskRow }) {
  if (row.status === "issue") {
    return (
      <span className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
        {row.issues.length} to fix
      </span>
    );
  }

  if (row.status === "internal") {
    return <span className="text-xs text-slate-500">Not billed</span>;
  }

  if (row.status === "included") {
    return (
      <span className="w-fit whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        Cost only
      </span>
    );
  }

  return row.ratio === null ? <span className="text-slate-400">—</span> : <RatioValue ratio={row.ratio} />;
}

function TaskFlow({ row }: { row: TaskRow }) {
  const margin = row.income !== null && row.effort !== null ? row.income - row.effort : null;

  return (
    <details className="group border-t border-slate-100 first:border-t-0">
      <summary
        className={`${ROW_GRID} cursor-pointer list-none px-5 py-3 transition hover:bg-[#FBF7FF] [&::-webkit-details-marker]:hidden`}
      >
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-950">{row.title}</p>
          <p className="truncate text-xs text-slate-500">
            {row.clientName ?? INTERNAL_LABEL}
            <span className="md:hidden"> · {row.work ?? "No service"}</span>
          </p>
        </div>
        <div className="hidden min-w-0 md:block">
          <p className="truncate text-sm text-slate-800">{row.work ?? "—"}</p>
          <p className="truncate text-xs text-slate-500">
            {row.payment ? formatPaymentTerms(row.payment) : row.status === "internal" ? "No client" : "—"}
          </p>
        </div>
        <p className="hidden text-right text-sm text-slate-600 tabular-nums md:block">
          {formatDuration(row.minutes)}
        </p>
        <p className="hidden text-right text-sm text-slate-900 tabular-nums md:block">
          {row.income === null ? "—" : formatInr(row.income)}
        </p>
        <p className="hidden text-right text-sm text-slate-900 tabular-nums md:block">
          {row.effort === null ? "—" : formatInr(row.effort)}
        </p>
        <div className="justify-self-end md:justify-self-start">
          <StatusCell row={row} />
        </div>
        <Chevron className="text-slate-400 group-open:rotate-90" />
      </summary>

      <div className="grid gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 lg:grid-cols-3">
        {/* Step 1 */}
        <StepCard
          step={1}
          title="Income"
          source={
            row.payment
              ? `${row.work} · ${formatPaymentTerms(row.payment)}, from Client Management`
              : row.status === "internal"
                ? "Internal work has no client to bill"
                : "No payment found for this work"
          }
          result={
            <Line
              strong
              label="Income"
              value={row.income === null ? (row.status === "internal" ? "Not billed" : "Missing") : formatInr(row.income)}
            />
          }
        >
          {row.breakdown ? (
            <IncomeLines breakdown={row.breakdown} row={row} />
          ) : row.status === "internal" ? (
            <p className="text-slate-600">
              Internal tasks have no client, so nothing is billed and they stay out of
              the totals. Their hours still show on the Reports page.
            </p>
          ) : (
            <p className="text-slate-600">The income cannot be worked out until the items in step 3 are fixed.</p>
          )}
        </StepCard>

        {/* Step 2 */}
        <StepCard
          step={2}
          title="Work effort"
          source={`Hours × base price for ${row.service ?? "the service"} at each employee's domain and designation`}
          result={
            <Line
              strong
              label="Work effort"
              value={row.effort === null ? (row.status === "internal" ? "Not priced" : "Missing") : formatInr(row.effort)}
            />
          }
        >
          {row.employees.map((line) => (
            <div key={line.userId} className="space-y-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-medium text-slate-900">{line.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {line.sector && line.designation
                      ? `${line.sector} · ${line.designation}`
                      : "No domain or designation"}
                  </span>
                </span>
                <span className="text-right tabular-nums text-slate-900">
                  {line.effort === null ? "—" : formatInr(line.effort)}
                </span>
              </div>
              <p className={`text-xs ${line.rate === null && row.status !== "internal" ? "text-amber-700" : "text-slate-500"}`}>
                {line.rate === null
                  ? `${formatDuration(line.minutes)} · ${row.status === "internal" ? "internal work is not priced" : "no base price"}`
                  : `${formatDuration(line.minutes)} × ${formatInr(line.rate)}/hr`}
              </p>
            </div>
          ))}
          {row.employees.length > 1 ? (
            <Line label="Total hours" value={formatDuration(row.minutes)} />
          ) : null}
        </StepCard>

        {/* Step 3 */}
        <StepCard
          step={3}
          title="Ratio"
          source="Income ÷ work effort, coloured on the five-step scale"
          result={
            margin === null || row.status !== "counted" ? (
              <Line
                strong
                label="In the totals"
                value={row.status === "included" ? "Yes, as cost" : "No"}
              />
            ) : (
              <Line strong label="Margin" value={signedInr(margin)} />
            )
          }
        >
          {row.status === "counted" && row.ratio !== null ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-slate-500">
                  {formatInr(row.income!)} ÷ {formatInr(row.effort!)}
                </span>
                <span className="text-2xl font-semibold text-slate-950 tabular-nums">
                  {roundRatio(row.ratio).toFixed(2)}
                </span>
              </div>
              <RatioScale ratio={row.ratio} showRanges />
              <p className="text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{ratioBand(row.ratio).colorName}</span>{" "}
                ({ratioBand(row.ratio).range}): {ratioBand(row.ratio).label.toLowerCase()}.
              </p>
            </>
          ) : row.status === "included" ? (
            <p className="text-slate-600">
              No ratio: there is no income to set against it. Its{" "}
              {row.effort === null ? "effort" : formatInr(row.effort)} is added to{" "}
              {row.clientName}&apos;s work effort.
            </p>
          ) : row.status === "internal" ? (
            <p className="text-slate-600">Not in the totals or the charts.</p>
          ) : (
            <>
              <p className="text-slate-600">Left out of the totals until this is fixed:</p>
              <IssueList row={row} />
            </>
          )}
        </StepCard>
      </div>
    </details>
  );
}

function ColumnHeadings() {
  return (
    <div
      className={`${ROW_GRID} hidden border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid`}
    >
      <span>Task · client</span>
      <span>Service · payment</span>
      <span className="text-right">Hours</span>
      <span className="text-right">Income</span>
      <span className="text-right">Work effort</span>
      <span>Ratio</span>
      <span />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The section                                                          */
/* ------------------------------------------------------------------ */

function FormulaStrip() {
  const steps = [
    { title: "Income", text: "From the client's payment for the service: per count, package or percentage" },
    { title: "Work effort", text: "Hours logged × base price for the service, domain and designation" },
    { title: "Ratio", text: "Income ÷ work effort, coloured from dark red to dark green" },
  ];

  return (
    <ol className="grid gap-2 md:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step.title} className="flex items-start gap-3 rounded-lg bg-[#FBF7FF] px-4 py-3 ring-1 ring-[#F3E8FF]">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#770FC2] text-xs font-semibold text-white">
            {index + 1}
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-950">{step.title}</span>
            <span className="block text-xs text-slate-600">{step.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function CalculationFlow({
  rows,
  groups,
  noun,
}: {
  rows: TaskRow[];
  groups: GroupTotal[];
  noun: GroupNoun;
}) {
  const keyOf = (row: TaskRow) => (noun === "client" ? row.clientId : row.service);
  const inTotals = rows.filter((row) => row.status === "counted" || row.status === "included");
  const issues = rows.filter((row) => row.status === "issue");
  const internal = rows.filter((row) => row.status === "internal");

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Calculation flow</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Every task, grouped by {noun}. Open a {noun} to list its tasks, then a task to see each step of its working.
          </p>
        </div>
        <FormulaStrip />
      </div>

      {rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">No time logged for these filters.</p>
      ) : (
        <>
          <ColumnHeadings />

          {groups.map((group) => {
            const members = inTotals.filter((row) => keyOf(row) === group.key);

            return (
              <details key={group.key} className="group/section border-b border-slate-200 last:border-b-0">
                <summary
                  className={`${ROW_GRID} cursor-pointer list-none bg-slate-100/70 px-5 py-3 transition hover:bg-[#F3E8FF]/60 [&::-webkit-details-marker]:hidden`}
                >
                  <p className="min-w-0 truncate font-semibold text-slate-950">
                    {group.name}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {group.tasks} {group.tasks === 1 ? "task" : "tasks"}
                    </span>
                  </p>
                  <span className="hidden md:block" />
                  <p className="hidden text-right text-sm font-semibold text-slate-700 tabular-nums md:block">
                    {formatDuration(group.minutes)}
                  </p>
                  <p className="hidden text-right text-sm font-semibold text-slate-950 tabular-nums md:block">
                    {formatInr(group.income)}
                  </p>
                  <p className="hidden text-right text-sm font-semibold text-slate-950 tabular-nums md:block">
                    {formatInr(group.effort)}
                  </p>
                  <div className="justify-self-end md:justify-self-start">
                    {group.ratio === null ? (
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
                        Cost only
                      </span>
                    ) : (
                      <RatioValue ratio={group.ratio} />
                    )}
                  </div>
                  <Chevron className="text-slate-500 group-open/section:rotate-90" />
                </summary>
                {members.map((row) => (
                  <TaskFlow key={row.taskId} row={row} />
                ))}
              </details>
            );
          })}

          {issues.length > 0 || internal.length > 0 ? (
            <details className="group/section border-t-4 border-slate-100">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 bg-amber-50/60 px-5 py-3 transition hover:bg-amber-50 [&::-webkit-details-marker]:hidden">
                <p className="font-semibold text-slate-950">
                  Not in the totals
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {issues.length > 0 ? `${issues.length} to fix` : null}
                    {issues.length > 0 && internal.length > 0 ? " · " : null}
                    {internal.length > 0 ? `${internal.length} internal` : null}
                  </span>
                </p>
                <span className="flex items-center gap-3 text-xs text-slate-500">
                  Open a task to see what is missing and where to fix it
                  <Chevron className="text-slate-500 group-open/section:rotate-90" />
                </span>
              </summary>
              {[...issues, ...internal].map((row) => (
                <TaskFlow key={row.taskId} row={row} />
              ))}
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
