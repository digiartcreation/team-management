"use client";

import { useState } from "react";
import type { ApexOptions } from "apexcharts";
import ApexChart from "@/components/reports/ApexChart";
import {
  INK,
  MIX_COLORS,
  OTHER_COLOR,
  SERIES,
  baseOptions,
  formatHoursValue,
  hours,
} from "@/components/reports/chartTheme";
import { formatDuration } from "@/lib/duration";
import {
  WEEKDAY_LABELS,
  type ReportAnalytics,
} from "@/lib/reportAnalytics";

/** Chart ids, shared with the PDF export so it can photograph each chart. */
export const CHART_IDS = {
  trend: "report-trend",
  ranking: "report-ranking",
  mix: "report-mix",
  rework: "report-rework",
  weekday: "report-weekday",
  reopen: "report-reopen",
} as const;

const GRANULARITY_LABEL = {
  day: "per day",
  week: "per week",
  month: "per month",
};

function percent(part: number, whole: number) {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "0%";
}

/* ------------------------------------------------------------------ */
/* Card chrome                                                          */
/* ------------------------------------------------------------------ */

function ChartCard({
  title,
  subtitle,
  table,
  children,
  className = "",
  empty,
}: {
  title: string;
  subtitle: string;
  /** The table twin: every value the chart shows, readable without hover. */
  table: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  empty?: boolean;
}) {
  const [mode, setMode] = useState<"chart" | "table">("chart");

  return (
    <section
      className={`flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
        {!empty ? (
          <div
            role="tablist"
            aria-label={`${title} view`}
            className="flex shrink-0 rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium"
          >
            {(["chart", "table"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={mode === option}
                onClick={() => setMode(option)}
                className={`rounded px-2.5 py-1 capitalize transition ${
                  mode === option
                    ? "bg-white text-[#770FC2] shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex-1">
        {empty ? (
          <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
            No time logged in this range
          </div>
        ) : mode === "chart" ? (
          children
        ) : (
          <div className="max-h-[360px] overflow-auto">{table}</div>
        )}
      </div>
    </section>
  );
}

function TwinTable({
  headings,
  rows,
}: {
  headings: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full text-left text-sm tabular-nums">
      <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-500">
        <tr className="border-b border-slate-200">
          {headings.map((heading, index) => (
            <th
              key={heading}
              className={`px-2 py-2 font-semibold ${index > 0 ? "text-right" : ""}`}
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="hover:bg-slate-50">
            {row.map((cell, index) => (
              <td
                key={index}
                className={`px-2 py-2 ${
                  index > 0 ? "text-right text-slate-600" : "font-medium text-slate-800"
                }`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A colour key beside text, so identity never rides on coloured text. */
function Key({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <span className="flex items-center gap-2 text-xs text-slate-600">
      <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
      {value ? <span className="font-semibold text-slate-900">{value}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Charts                                                               */
/* ------------------------------------------------------------------ */

const stackedBarShape = {
  stacked: true,
  stroke: { show: true, width: 2, colors: [INK.surface] },
};

function TrendChart({ data }: { data: ReportAnalytics }) {
  const { trend, granularity } = data;
  const columnWidth =
    trend.length <= 4 ? "22%" : trend.length <= 12 ? "45%" : "70%";

  const options: ApexOptions = {
    ...baseOptions(CHART_IDS.trend),
    chart: {
      ...baseOptions(CHART_IDS.trend).chart,
      type: "bar",
      stacked: stackedBarShape.stacked,
    },
    colors: [SERIES.firstPass, SERIES.rework],
    stroke: stackedBarShape.stroke,
    plotOptions: {
      bar: {
        columnWidth,
        borderRadius: 4,
        borderRadiusApplication: "end",
        borderRadiusWhenStacked: "last",
      },
    },
    xaxis: {
      categories: trend.map((bucket) => bucket.label),
      axisBorder: { color: INK.axis },
      axisTicks: { show: false },
      labels: {
        rotate: -45,
        hideOverlappingLabels: true,
        style: { fontSize: "11px", colors: INK.muted },
      },
    },
    yaxis: {
      labels: {
        formatter: (value: number) => `${Math.round(value)}h`,
        style: { fontSize: "11px", colors: INK.muted },
      },
    },
    legend: { ...baseOptions(CHART_IDS.trend).legend, position: "top", horizontalAlign: "right" },
    tooltip: {
      ...baseOptions(CHART_IDS.trend).tooltip,
      shared: true,
      intersect: false,
    },
  };

  return (
    <ChartCard
      title="Hours over time"
      subtitle={`Time logged ${GRANULARITY_LABEL[granularity]}, first pass and rework stacked`}
      className="lg:col-span-2"
      empty={data.kpis.total === 0}
      table={
        <TwinTable
          headings={["Period", "First pass", "Rework", "Total"]}
          rows={trend.map((bucket) => [
            bucket.label,
            formatDuration(bucket.firstPass),
            formatDuration(bucket.rework),
            formatDuration(bucket.firstPass + bucket.rework),
          ])}
        />
      }
    >
      <ApexChart
        type="bar"
        height={320}
        options={options}
        series={[
          { name: "First pass", data: trend.map((bucket) => hours(bucket.firstPass)) },
          { name: "Rework", data: trend.map((bucket) => hours(bucket.rework)) },
        ]}
      />
    </ChartCard>
  );
}

function ReworkMeter({ data }: { data: ReportAnalytics }) {
  const { kpis } = data;
  const rate = Math.round(kpis.reworkRate * 10) / 10;
  // The fill carries severity; the label says it in words as well.
  const level =
    rate <= 10
      ? { color: "#770FC2", track: "#F3E8FF", label: "Healthy" }
      : rate <= 25
        ? { color: "#D98A00", track: "#FDF1D8", label: "Watch" }
        : { color: "#D03B3B", track: "#FBE3E3", label: "High" };

  const options: ApexOptions = {
    ...baseOptions(CHART_IDS.rework),
    chart: { ...baseOptions(CHART_IDS.rework).chart, type: "radialBar", sparkline: { enabled: true } },
    colors: [level.color],
    plotOptions: {
      radialBar: {
        startAngle: -120,
        endAngle: 120,
        hollow: { size: "64%" },
        track: { background: level.track, strokeWidth: "100%" },
        dataLabels: {
          name: {
            show: true,
            offsetY: 26,
            fontSize: "12px",
            color: INK.secondary,
          },
          value: {
            offsetY: -12,
            fontSize: "30px",
            fontWeight: 600,
            color: INK.primary,
            formatter: (value: number) => `${value}%`,
          },
        },
      },
    },
    stroke: { lineCap: "round" },
    labels: [`${level.label} rework`],
    tooltip: { enabled: false },
  };

  return (
    <ChartCard
      title="Rework rate"
      subtitle="Share of logged time spent after a reopen"
      empty={kpis.total === 0}
      table={
        <TwinTable
          headings={["Measure", "Value"]}
          rows={[
            ["First pass", formatDuration(kpis.firstPass)],
            ["Rework", formatDuration(kpis.rework)],
            ["Rework rate", `${rate}%`],
            ["Reopened tasks", kpis.reopenedTasks],
          ]}
        />
      }
    >
      <ApexChart
        type="radialBar"
        height={240}
        options={options}
        series={[Math.min(rate, 100)]}
      />
      <div className="mt-2 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
        <div>
          <Key color={SERIES.firstPass} label="First pass" />
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {formatDuration(kpis.firstPass)}
          </p>
        </div>
        <div>
          <Key color={SERIES.rework} label="Rework" />
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {formatDuration(kpis.rework)}
          </p>
        </div>
      </div>
    </ChartCard>
  );
}

function RankingChart({
  data,
  title,
  subtitle,
}: {
  data: ReportAnalytics;
  title: string;
  subtitle: string;
}) {
  const { ranking } = data;
  const height = Math.max(220, ranking.length * 40 + 70);

  const options: ApexOptions = {
    ...baseOptions(CHART_IDS.ranking),
    chart: { ...baseOptions(CHART_IDS.ranking).chart, type: "bar", stacked: true },
    colors: [SERIES.firstPass, SERIES.rework],
    stroke: stackedBarShape.stroke,
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: ranking.length <= 3 ? "38%" : "62%",
        borderRadius: 4,
        borderRadiusApplication: "end",
        borderRadiusWhenStacked: "last",
        dataLabels: {
          total: {
            enabled: true,
            offsetX: 6,
            formatter: (value?: string) => formatHoursValue(Number(value ?? 0)),
            style: { fontSize: "11px", fontWeight: 600, color: INK.primary },
          },
        },
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: ranking.map((item) => item.label),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        formatter: (value: string) => `${Math.round(Number(value))}h`,
        style: { fontSize: "11px", colors: INK.muted },
      },
    },
    yaxis: {
      labels: {
        maxWidth: 160,
        style: { fontSize: "12px", colors: INK.primary },
      },
    },
    grid: { ...baseOptions(CHART_IDS.ranking).grid, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    legend: { ...baseOptions(CHART_IDS.ranking).legend, position: "top", horizontalAlign: "right" },
    tooltip: { ...baseOptions(CHART_IDS.ranking).tooltip, shared: true, intersect: false },
  };

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      className="lg:col-span-2"
      empty={data.kpis.total === 0}
      table={
        <TwinTable
          headings={["Name", "First pass", "Rework", "Total", "Share"]}
          rows={ranking.map((item) => [
            item.label,
            formatDuration(item.firstPass),
            formatDuration(item.rework),
            formatDuration(item.minutes),
            percent(item.minutes, data.kpis.total),
          ])}
        />
      }
    >
      <ApexChart
        type="bar"
        height={height}
        options={options}
        series={[
          { name: "First pass", data: ranking.map((item) => hours(item.firstPass)) },
          { name: "Rework", data: ranking.map((item) => hours(item.rework)) },
        ]}
      />
    </ChartCard>
  );
}

function MixDonut({ data }: { data: ReportAnalytics }) {
  const { slices, title } = data.share;
  const total = data.kpis.total;
  const colors = slices.map((slice, index) =>
    slice.label.startsWith("Other (") ? OTHER_COLOR : MIX_COLORS[index % MIX_COLORS.length]
  );

  const options: ApexOptions = {
    ...baseOptions(CHART_IDS.mix),
    chart: { ...baseOptions(CHART_IDS.mix).chart, type: "donut" },
    labels: slices.map((slice) => slice.label),
    colors,
    stroke: { width: 2, colors: [INK.surface] },
    legend: { show: false },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: "72%",
          labels: {
            show: true,
            name: { fontSize: "12px", color: INK.secondary, offsetY: 18 },
            value: {
              fontSize: "22px",
              fontWeight: 600,
              color: INK.primary,
              offsetY: -14,
              formatter: (value: string) => formatHoursValue(Number(value)),
            },
            total: {
              show: true,
              label: "Total",
              color: INK.secondary,
              fontSize: "12px",
              formatter: () => formatDuration(total),
            },
          },
        },
      },
    },
  };

  return (
    <ChartCard
      title={title}
      subtitle="Where the hours went, by share"
      empty={total === 0}
      table={
        <TwinTable
          headings={["Name", "Time", "Share"]}
          rows={slices.map((slice) => [
            slice.label,
            formatDuration(slice.minutes),
            percent(slice.minutes, total),
          ])}
        />
      }
    >
      <ApexChart
        type="donut"
        height={220}
        options={options}
        series={slices.map((slice) => hours(slice.minutes))}
      />
      {/* The legend is the identity channel, with each value spelled out. */}
      <ul className="mt-4 grid gap-2">
        {slices.map((slice, index) => (
          <li key={slice.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colors[index] }} />
              <span className="truncate">{slice.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-900">
              <span className="font-semibold">{formatDuration(slice.minutes)}</span>
              <span className="ml-2 text-slate-400">{percent(slice.minutes, total)}</span>
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

/** Violet ramp, light to dark, for the workload heatmap's bins. */
const HEAT_STEPS = ["#E9D5FA", "#C99BEE", "#A05DD0", "#770FC2", "#4C0880"];

function WeekdayHeatmap({ data }: { data: ReportAnalytics }) {
  const rows = data.weekdays;
  const maxHours = Math.max(
    0.25,
    ...rows.flatMap((row) => row.minutes.map((minutes) => hours(minutes)))
  );
  const step = maxHours / HEAT_STEPS.length;

  // Apex draws the first series at the bottom; reversing keeps the busiest
  // person on top, matching the table.
  const series = [...rows].reverse().map((row) => ({
    name: row.name,
    data: row.minutes.map((minutes, index) => ({
      x: WEEKDAY_LABELS[index],
      y: hours(minutes),
    })),
  }));

  const ranges = [
    { from: 0, to: 0, color: "#F5F4F8", name: "None" },
    ...HEAT_STEPS.map((color, index) => ({
      from: index === 0 ? 0.01 : Math.round(step * index * 10) / 10 + 0.01,
      to: index === HEAT_STEPS.length - 1 ? maxHours + 1 : Math.round(step * (index + 1) * 10) / 10,
      color,
      name:
        index === HEAT_STEPS.length - 1
          ? `${Math.round(step * index * 10) / 10}h+`
          : `≤${Math.round(step * (index + 1) * 10) / 10}h`,
    })),
  ];

  const options: ApexOptions = {
    ...baseOptions(CHART_IDS.weekday),
    chart: { ...baseOptions(CHART_IDS.weekday).chart, type: "heatmap" },
    stroke: { width: 3, colors: [INK.surface] },
    plotOptions: {
      heatmap: {
        radius: 4,
        enableShades: false,
        colorScale: { ranges },
      },
    },
    dataLabels: {
      enabled: rows.length <= 8,
      formatter: (value: number | string | number[]) =>
        Number(value) > 0 ? `${value}` : "",
      style: { fontSize: "10px", fontWeight: 500, colors: [INK.surface] },
    },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: "11px", colors: INK.muted } },
    },
    yaxis: { labels: { maxWidth: 120, style: { fontSize: "12px", colors: INK.primary } } },
    legend: { ...baseOptions(CHART_IDS.weekday).legend, position: "bottom" },
    grid: { ...baseOptions(CHART_IDS.weekday).grid, show: false },
  };

  return (
    <ChartCard
      title="Weekly rhythm"
      subtitle="Hours each person logged by day of the week"
      className="lg:col-span-2"
      empty={rows.length === 0}
      table={
        <TwinTable
          headings={["Employee", ...WEEKDAY_LABELS]}
          rows={rows.map((row) => [row.name, ...row.minutes.map((minutes) => (minutes > 0 ? formatDuration(minutes) : "–"))])}
        />
      }
    >
      <ApexChart
        type="heatmap"
        height={Math.max(220, rows.length * 38 + 90)}
        options={options}
        series={series}
      />
    </ChartCard>
  );
}

function ReopenChart({ data }: { data: ReportAnalytics }) {
  const tasks = data.reopens;
  const height = Math.max(220, tasks.length * 44 + 70);

  const options: ApexOptions = {
    ...baseOptions(CHART_IDS.reopen),
    chart: { ...baseOptions(CHART_IDS.reopen).chart, type: "bar", stacked: true },
    colors: [SERIES.firstPass, SERIES.rework],
    stroke: stackedBarShape.stroke,
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: tasks.length <= 3 ? "38%" : "62%",
        borderRadius: 4,
        borderRadiusApplication: "end",
        borderRadiusWhenStacked: "last",
      },
    },
    xaxis: {
      categories: tasks.map((task) => task.title),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        formatter: (value: string) => `${Math.round(Number(value))}h`,
        style: { fontSize: "11px", colors: INK.muted },
      },
    },
    yaxis: { labels: { maxWidth: 150, style: { fontSize: "12px", colors: INK.primary } } },
    grid: { ...baseOptions(CHART_IDS.reopen).grid, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    legend: { ...baseOptions(CHART_IDS.reopen).legend, position: "top", horizontalAlign: "right" },
    tooltip: { ...baseOptions(CHART_IDS.reopen).tooltip, shared: true, intersect: false },
  };

  return (
    <ChartCard
      title="Cost of rework"
      subtitle="Tasks with the most time spent after a reopen"
      empty={tasks.length === 0}
      table={
        <TwinTable
          headings={["Task", "Reopens", "First pass", "Rework"]}
          rows={tasks.map((task) => [
            task.title,
            task.reopenCount,
            formatDuration(task.originalMinutes),
            formatDuration(task.reopenMinutes),
          ])}
        />
      }
    >
      <ApexChart
        type="bar"
        height={height}
        options={options}
        series={[
          { name: "First pass", data: tasks.map((task) => hours(task.originalMinutes)) },
          { name: "Rework", data: tasks.map((task) => hours(task.reopenMinutes)) },
        ]}
      />
    </ChartCard>
  );
}

export default function ReportCharts({
  data,
  rankingTitle,
  rankingSubtitle,
}: {
  data: ReportAnalytics;
  rankingTitle: string;
  rankingSubtitle: string;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <TrendChart data={data} />
      <ReworkMeter data={data} />
      <RankingChart data={data} title={rankingTitle} subtitle={rankingSubtitle} />
      <MixDonut data={data} />
      <WeekdayHeatmap data={data} />
      <ReopenChart data={data} />
    </div>
  );
}
