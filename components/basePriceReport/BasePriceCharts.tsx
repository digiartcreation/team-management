"use client";

import type { ApexOptions } from "apexcharts";
import ApexChart from "@/components/reports/ApexChart";
import { ChartCard, TwinTable } from "@/components/reports/ReportCharts";
import { INK, baseOptions } from "@/components/reports/chartTheme";
import {
  RATIO_BANDS,
  ratioBand,
  roundRatio,
  type GroupTotal,
} from "@/lib/basePriceReport";
import { formatDuration } from "@/lib/duration";
import { formatInr } from "@/lib/services";

/** Income wears the brand violet, effort a slate that reads as cost. */
export const INCOME_COLOR = "#770FC2";
export const EFFORT_COLOR = "#4B5567";

/** Where the scale changes colour, drawn as guides on the ratio chart. */
const BAND_EDGES = [0.9, 1, 1.29, 1.6];

export type GroupNoun = "client" | "service";

/** Axis ticks only: "₹15K", "₹1.2L". Tooltips and tables carry exact rupees. */
function compactInr(value: number) {
  if (value >= 100000) return `₹${Number((value / 100000).toFixed(1))}L`;
  if (value >= 1000) return `₹${Number((value / 1000).toFixed(1))}K`;
  return `₹${Math.round(value)}`;
}

function marginText(group: GroupTotal) {
  const margin = group.income - group.effort;
  return `${margin < 0 ? "−" : "+"}${formatInr(Math.abs(margin))}`;
}

function AmountsChart({ groups, noun }: { groups: GroupTotal[]; noun: GroupNoun }) {
  const id = `base-price-amounts-${noun}`;
  const base = baseOptions(id);
  const height = Math.max(260, groups.length * 62 + 90);

  const options: ApexOptions = {
    ...base,
    chart: { ...base.chart, type: "bar" },
    colors: [INCOME_COLOR, EFFORT_COLOR],
    // The 2px surface gap between a row's two bars.
    stroke: { show: true, width: 2, colors: [INK.surface] },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: groups.length <= 2 ? "50%" : "74%",
        borderRadius: 4,
        borderRadiusApplication: "end",
      },
    },
    xaxis: {
      categories: groups.map((group) => group.name),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        formatter: (value: string) => compactInr(Number(value)),
        style: { fontSize: "11px", colors: INK.muted },
      },
    },
    yaxis: {
      labels: { maxWidth: 150, style: { fontSize: "12px", colors: INK.primary } },
    },
    grid: { ...base.grid, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    legend: { ...base.legend, position: "top", horizontalAlign: "right" },
    tooltip: {
      ...base.tooltip,
      shared: true,
      intersect: false,
      y: { formatter: (value: number) => formatInr(value) },
    },
  };

  return (
    <ChartCard
      title={`Income and work effort by ${noun}`}
      subtitle="Income from service payments · effort is hours × base price"
      empty={groups.length === 0}
      emptyText="No priced client work for these filters"
      table={
        <TwinTable
          headings={[noun === "client" ? "Client" : "Service", "Income", "Work effort", "Margin", "Hours"]}
          rows={groups.map((group) => [
            group.name,
            formatInr(group.income),
            formatInr(group.effort),
            marginText(group),
            formatDuration(group.minutes),
          ])}
        />
      }
    >
      <ApexChart
        type="bar"
        height={height}
        options={options}
        series={[
          { name: "Income", data: groups.map((group) => Math.round(group.income)) },
          { name: "Work effort", data: groups.map((group) => Math.round(group.effort)) },
        ]}
      />
    </ChartCard>
  );
}

function RatioChart({ groups, noun }: { groups: GroupTotal[]; noun: GroupNoun }) {
  const id = `base-price-ratio-${noun}`;
  const base = baseOptions(id);
  // Client Management alone has effort and nothing billed, so no ratio to draw.
  const rated = groups
    .filter((group) => group.ratio !== null)
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0));
  const costOnly = groups.filter((group) => group.costOnly);
  const height = Math.max(260, rated.length * 44 + 90);
  const ratios = rated.map((group) => roundRatio(group.ratio!));
  const colors = rated.map((group) => ratioBand(group.ratio!).color);
  const bandCounts = RATIO_BANDS.map(
    (band) => rated.filter((group) => ratioBand(group.ratio!) === band).length
  );
  // Room past the longest bar for its label, on a scale that keeps 1.6 in view.
  const highest = Math.max(0, ...ratios);
  const max =
    highest * 1.15 <= 3
      ? Math.max(2, Math.ceil(highest * 1.15 * 2) / 2)
      : Math.ceil(highest * 1.15);

  const options: ApexOptions = {
    ...base,
    // Stacked with one series so the value label sits past the bar's end.
    chart: { ...base.chart, type: "bar", stacked: true },
    colors: [({ dataPointIndex }: { dataPointIndex: number }) => colors[dataPointIndex]],
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: rated.length <= 2 ? "40%" : "62%",
        borderRadius: 4,
        borderRadiusApplication: "end",
        borderRadiusWhenStacked: "last",
        dataLabels: {
          total: {
            enabled: true,
            offsetX: 6,
            formatter: (value?: string) => Number(value ?? 0).toFixed(2),
            style: { fontSize: "11px", fontWeight: 600, color: INK.primary },
          },
        },
      },
    },
    annotations: {
      xaxis: BAND_EDGES.map((edge) => ({
        x: edge,
        borderColor: edge === 1 ? INK.secondary : INK.axis,
        strokeDashArray: 0,
        opacity: 1,
      })),
    },
    xaxis: {
      categories: rated.map((group) => group.name),
      min: 0,
      max,
      tickAmount: max <= 3 ? max * 2 : max,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        formatter: (value: string) => Number(value).toFixed(1),
        style: { fontSize: "11px", colors: INK.muted },
      },
    },
    yaxis: {
      labels: { maxWidth: 150, style: { fontSize: "12px", colors: INK.primary } },
    },
    grid: { ...base.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: false } } },
    legend: { show: false },
    tooltip: {
      ...base.tooltip,
      y: {
        title: { formatter: () => "Ratio" },
        formatter: (value, opts) => {
          const group = rated[opts?.dataPointIndex ?? -1];

          if (!group) {
            return value.toFixed(2);
          }

          return `${value.toFixed(2)} · ${ratioBand(group.ratio!).colorName} (${formatInr(group.income)} ÷ ${formatInr(group.effort)})`;
        },
      },
    },
  };

  return (
    <ChartCard
      title={`Ratio by ${noun}`}
      subtitle="Income ÷ work effort, coloured on the five-step scale"
      empty={rated.length === 0}
      emptyText={
        costOnly.length > 0 ? "Only unbilled Client Management work here" : "No priced client work for these filters"
      }
      table={
        <TwinTable
          headings={[noun === "client" ? "Client" : "Service", "Income", "Work effort", "Ratio", "Band"]}
          rows={rated.map((group) => [
            group.name,
            formatInr(group.income),
            formatInr(group.effort),
            roundRatio(group.ratio!).toFixed(2),
            ratioBand(group.ratio!).colorName,
          ])}
        />
      }
    >
      <ApexChart
        type="bar"
        height={height}
        options={options}
        series={[{ name: "Ratio", data: ratios }]}
      />
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-5">
        {RATIO_BANDS.map((band, index) => (
          <li key={band.colorName} className="flex items-start gap-1.5">
            <span aria-hidden className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: band.color }} />
            <span className="leading-tight">
              <span className="block font-medium text-slate-800">{band.colorName}</span>
              <span className="text-slate-500">{band.range}</span>
              <span className="block font-semibold text-slate-700 tabular-nums">
                {bandCounts[index]} {noun === "client" ? (bandCounts[index] === 1 ? "client" : "clients") : bandCounts[index] === 1 ? "service" : "services"}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {costOnly.length > 0 ? (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Cost only, no ratio: </span>
          {costOnly
            .map((group) => `${group.name} (${formatInr(group.effort)} of effort)`)
            .join(", ")}
          . Client Management is never billed, so its effort only adds cost.
        </p>
      ) : null}
    </ChartCard>
  );
}

export default function BasePriceCharts({
  groups,
  noun,
}: {
  groups: GroupTotal[];
  noun: GroupNoun;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <AmountsChart groups={groups} noun={noun} />
      <RatioChart groups={groups} noun={noun} />
    </div>
  );
}
