"use client";

import dynamic from "next/dynamic";
import type { Props } from "react-apexcharts";

/**
 * ApexCharts measures the DOM as it draws, so it only ever renders in the
 * browser. The placeholder holds the chart's height so nothing jumps when it
 * arrives.
 */
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[200px] w-full animate-pulse rounded-md bg-slate-100/70" />
  ),
});

export default function ApexChart(props: Props) {
  return (
    <div style={{ minHeight: props.height }}>
      <ReactApexChart {...props} />
    </div>
  );
}
