import { BandChip, RatioScale, RatioValue } from "@/components/basePriceReport/RatioBand";
import type { GroupNoun } from "@/components/basePriceReport/BasePriceCharts";
import type { BasePriceReport, GroupTotal } from "@/lib/basePriceReport";
import { formatDuration } from "@/lib/duration";
import { formatInr } from "@/lib/services";

function signedInr(amount: number) {
  return `${amount < 0 ? "−" : "+"}${formatInr(Math.abs(amount))}`;
}

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function Tile({
  label,
  value,
  hint,
  accent = false,
  valueClass = "text-slate-950",
}: {
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  accent?: boolean;
  valueClass?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border p-4 shadow-sm ${
        accent
          ? "border-transparent bg-linear-to-br from-[#770FC2] to-[#4C0880] text-white"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className={`text-xs font-medium ${accent ? "text-white/75" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${accent ? "text-white" : valueClass}`}>
        {value}
      </p>
      <div className={`mt-auto pt-2 text-xs ${accent ? "text-white/80" : "text-slate-500"}`}>{hint}</div>
    </div>
  );
}

/** Income, effort, what is left, and the ratio on its scale. */
export function ReportKpis({ report }: { report: BasePriceReport }) {
  const { totals } = report;
  const margin = totals.income - totals.effort;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        accent
        label="Income"
        value={formatInr(totals.income)}
        hint={`${totals.tasks} ${totals.tasks === 1 ? "task" : "tasks"} in the totals`}
      />
      <Tile
        label="Work effort"
        value={formatInr(totals.effort)}
        hint={`${formatDuration(totals.minutes)} × base price`}
      />
      <Tile
        label="Margin"
        value={signedInr(margin)}
        valueClass={margin < 0 ? "text-red-700" : "text-emerald-700"}
        hint={
          totals.income > 0
            ? `${percent(margin, totals.income)}% of income left after effort`
            : "No income in these filters"
        }
      />
      <Tile
        label="Ratio · income ÷ effort"
        value={
          totals.ratio === null ? (
            "—"
          ) : (
            <span className="flex items-center gap-2">
              {totals.ratio.toFixed(2)}
              <BandChip ratio={totals.ratio} />
            </span>
          )
        }
        hint={totals.ratio === null ? "Nothing priced yet" : <RatioScale ratio={totals.ratio} />}
      />
    </div>
  );
}

/** One row per client or service: the numbers behind both charts. */
export function GroupSummaryTable({
  groups,
  noun,
  totals,
}: {
  groups: GroupTotal[];
  noun: GroupNoun;
  totals: BasePriceReport["totals"];
}) {
  const heading = noun === "client" ? "Client" : "Service";

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{heading} summary</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Every {noun} in the totals, highest income first
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Margin = income − work effort · Ratio = income ÷ work effort
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">
          Nothing priced for these filters yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-225 text-left text-sm tabular-nums">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">{heading}</th>
                <th className="px-4 py-3 text-right font-semibold">Tasks</th>
                <th className="px-4 py-3 text-right font-semibold">Hours</th>
                <th className="px-4 py-3 text-right font-semibold">Income</th>
                <th className="px-4 py-3 text-right font-semibold">Work effort</th>
                <th className="px-4 py-3 text-right font-semibold">Margin</th>
                <th className="px-4 py-3 font-semibold">Ratio</th>
                <th className="px-5 py-3 font-semibold">Share of income</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((group) => {
                const margin = group.income - group.effort;
                const share = percent(group.income, totals.income);

                return (
                  <tr key={group.key} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-950">{group.name}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{group.tasks}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatDuration(group.minutes)}</td>
                    <td className="px-4 py-3 text-right text-slate-900">{formatInr(group.income)}</td>
                    <td className="px-4 py-3 text-right text-slate-900">{formatInr(group.effort)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${margin < 0 ? "text-red-700" : "text-emerald-700"}`}>
                      {signedInr(margin)}
                    </td>
                    <td className="px-4 py-3">
                      {group.ratio === null ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          Cost only
                        </span>
                      ) : (
                        <RatioValue ratio={group.ratio} />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-[#770FC2]" style={{ width: `${share}%` }} />
                        </div>
                        <span className="w-9 text-right text-xs text-slate-600">{share}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-950">
              <tr>
                <td className="px-5 py-3">Total</td>
                <td className="px-4 py-3 text-right">{totals.tasks}</td>
                <td className="px-4 py-3 text-right">{formatDuration(totals.minutes)}</td>
                <td className="px-4 py-3 text-right">{formatInr(totals.income)}</td>
                <td className="px-4 py-3 text-right">{formatInr(totals.effort)}</td>
                <td className={`px-4 py-3 text-right ${totals.income - totals.effort < 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {signedInr(totals.income - totals.effort)}
                </td>
                <td className="px-4 py-3">
                  {totals.ratio === null ? "—" : <RatioValue ratio={totals.ratio} />}
                </td>
                <td className="px-5 py-3 text-xs text-slate-500">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
