"use client";

import type { ApexOptions } from "apexcharts";
import ApexChart from "@/components/reports/ApexChart";
import { ChartCard, TwinTable } from "@/components/reports/ReportCharts";
import { INK, OTHER_COLOR, baseOptions } from "@/components/reports/chartTheme";
import {
  RATIO_BANDS,
  ratioBand,
  roundRatio,
  type ClientTotal,
} from "@/lib/basePriceReport";
import { formatDuration } from "@/lib/duration";
import { formatInr } from "@/lib/services";

/** Income wears the brand violet, effort a slate that reads as cost. */
export const INCOME_COLOR = "#770FC2";
export const EFFORT_COLOR = "#4B5567";

/** Where the scale changes colour, drawn as guides on the ratio chart. */
const BAND_EDGES = [0.9, 1, 1.29, 1.6];

/** Axis ticks only: "₹15K", "₹1.2L". Tooltips and tables carry exact rupees. */
function compactInr(value: number) {
  if (value >= 100000) return `₹${Number((value / 100000).toFixed(1))}L`;
  if (value >= 1000) return `₹${Number((value / 1000).toFixed(1))}K`;
  return `₹${Math.round(value)}`;
}

function AmountsChart({ clients }: { clients: ClientTotal[] }) {
  const id = "base-price-amounts";
  const base = baseOptions(id);
  const height = Math.max(240, clients.length * 64 + 80);

  const options: ApexOptions = {
    ...base,
    chart: { ...base.chart, type: "bar" },
    colors: [INCOME_COLOR, EFFORT_COLOR],
    // The 2px surface gap between a client's two bars.
    stroke: { show: true, width: 2, colors: [INK.surface] },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: clients.length <= 2 ? "50%" : "72%",
        borderRadius: 4,
        borderRadiusApplication: "end",
      },
    },
    xaxis: {
      categories: clients.map((client) => client.name),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        formatter: (value: string) => compactInr(Number(value)),
        style: { fontSize: "11px", colors: INK.muted },
      },
    },
    yaxis: {
      labels: { maxWidth: 140, style: { fontSize: "12px", colors: INK.primary } },
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
      title="Income and work effort by client"
      subtitle="Income from service payments · effort is hours × base price"
      empty={clients.length === 0}
      emptyText="No priced client work in this month"
      table={
        <TwinTable
          headings={["Client", "Income", "Work effort", "Hours"]}
          rows={clients.map((client) => [
            client.name,
            formatInr(client.income),
            formatInr(client.effort),
            formatDuration(client.minutes),
          ])}
        />
      }
    >
      <ApexChart
        type="bar"
        height={height}
        options={options}
        series={[
          { name: "Income", data: clients.map((client) => client.income) },
          { name: "Work effort", data: clients.map((client) => client.effort) },
        ]}
      />
    </ChartCard>
  );
}

function RatioChart({ clients }: { clients: ClientTotal[] }) {
  const id = "base-price-ratio";
  const base = baseOptions(id);
  const height = Math.max(240, clients.length * 44 + 80);
  const ratios = clients.map((client) => roundRatio(client.ratio ?? 0));
  const colors = clients.map((client) =>
    client.ratio === null ? OTHER_COLOR : ratioBand(client.ratio).color
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
        barHeight: clients.length <= 2 ? "40%" : "62%",
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
      categories: clients.map((client) => client.name),
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
      labels: { maxWidth: 140, style: { fontSize: "12px", colors: INK.primary } },
    },
    grid: { ...base.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: false } } },
    legend: { show: false },
    tooltip: {
      ...base.tooltip,
      y: {
        title: { formatter: () => "Ratio" },
        formatter: (value, opts) => {
          const client = clients[opts?.dataPointIndex ?? -1];

          if (!client || client.ratio === null) {
            return "No effort to compare";
          }

          const band = ratioBand(client.ratio);

          return `${value.toFixed(2)} · ${band.colorName} (${formatInr(client.income)} ÷ ${formatInr(client.effort)})`;
        },
      },
    },
  };

  return (
    <ChartCard
      title="Ratio by client"
      subtitle="Income ÷ work effort, coloured on the five-step scale"
      empty={clients.length === 0}
      emptyText="No priced client work in this month"
      table={
        <TwinTable
          headings={["Client", "Ratio", "Band"]}
          rows={clients.map((client) => [
            client.name,
            client.ratio === null ? "—" : roundRatio(client.ratio).toFixed(2),
            client.ratio === null ? "—" : ratioBand(client.ratio).colorName,
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
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
        {RATIO_BANDS.map((band) => (
          <li key={band.colorName} className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: band.color }} />
            <span className="font-medium text-slate-800">{band.colorName}</span>
            <span className="text-slate-500">{band.range}</span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

export default function BasePriceCharts({ clients }: { clients: ClientTotal[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AmountsChart clients={clients} />
      <RatioChart clients={clients} />
    </div>
  );
}
