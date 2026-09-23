import type { ApexOptions } from "apexcharts";
import { formatDuration } from "@/lib/duration";

/**
 * Report chart colours. First pass wears the brand violet and rework the
 * orange, validated as a pair (CVD and normal-vision separation both pass).
 * The mix palette is violet followed by the reference categorical order; its
 * lighter hues sit under 3:1 on white, so the donut always carries a legend
 * with values and every chart has a table twin.
 */
export const SERIES = {
  firstPass: "#770FC2",
  rework: "#EB6834",
};

export const MIX_COLORS = [
  "#770FC2",
  "#2A78D6",
  "#EB6834",
  "#1BAF7A",
  "#EDA100",
  "#E87BA4",
];

/** "Other" is never a hue of its own. */
export const OTHER_COLOR = "#B8B6B0";

export const INK = {
  primary: "#1F2937",
  secondary: "#6B7280",
  muted: "#9CA3AF",
  grid: "#EEEDF2",
  axis: "#D9D7E0",
  surface: "#FFFFFF",
};

/** Minutes -> hours with one decimal, for axes. */
export function hours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

/** Every chart plots hours but reads them back as "7h 30m". */
export function formatHoursValue(value: number) {
  return formatDuration(Math.round(value * 60));
}

/** The chrome every report chart shares: quiet grid, no toolbar, system sans. */
export function baseOptions(id: string): ApexOptions {
  return {
    chart: {
      id,
      // Named outright rather than "inherit": the PDF export renders the SVG
      // on its own, where an inherited font falls back to a serif.
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      foreColor: INK.secondary,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, speed: 400 },
      background: "transparent",
    },
    grid: {
      borderColor: INK.grid,
      strokeDashArray: 0,
      padding: { left: 8, right: 8 },
    },
    dataLabels: { enabled: false },
    legend: {
      fontSize: "12px",
      markers: { size: 6, offsetX: -2 },
      itemMargin: { horizontal: 10 },
      labels: { colors: INK.secondary },
    },
    tooltip: {
      theme: "light",
      y: { formatter: (value: number) => formatHoursValue(value) },
    },
    states: {
      hover: { filter: { type: "darken" } },
      active: { filter: { type: "none" } },
    },
  };
}
