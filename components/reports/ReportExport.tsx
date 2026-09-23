"use client";

import { useState } from "react";
import { CHART_IDS } from "@/components/reports/ReportCharts";
import { formatDuration } from "@/lib/duration";
import type { ReportAnalytics } from "@/lib/reportAnalytics";
import type { ReopenTotal, ReportGroup } from "@/lib/reports";

export type ReportExportProps = {
  heading: string;
  /** "12 Sep 2026 – 23 Sep 2026 · Client: Acme", for the export headers. */
  scope: string;
  fileStem: string;
  groupHeading: string;
  detailHeadings: string[];
  showPeople: boolean;
  groups: ReportGroup[];
  reopened: ReopenTotal[];
  /** Reopen reasons keyed "taskId:cycle". */
  reasons: Record<string, { reason: string | null; by: string }>;
  analytics: ReportAnalytics;
};

const BRAND = "770FC2";
const BRAND_TINT = "F3E8FF";

function decimalHours(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function generatedOn() {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
}

function kpiRows(analytics: ReportAnalytics) {
  const { kpis } = analytics;

  return [
    ["Total time", formatDuration(kpis.total), decimalHours(kpis.total)],
    ["First pass", formatDuration(kpis.firstPass), decimalHours(kpis.firstPass)],
    ["Rework", formatDuration(kpis.rework), decimalHours(kpis.rework)],
    ["Rework rate", `${kpis.reworkRate.toFixed(1)}%`, null],
    ["Average per task", formatDuration(kpis.averagePerTask), decimalHours(kpis.averagePerTask)],
    ["Average per active day", formatDuration(kpis.averagePerDay), decimalHours(kpis.averagePerDay)],
    ["Tasks", String(kpis.tasks), null],
    ["Reopened tasks", String(kpis.reopenedTasks), null],
    ["Employees", String(kpis.employees), null],
    ["Clients", String(kpis.clients), null],
    ["Services", String(kpis.services), null],
    ["Time entries", String(kpis.entries), null],
  ] as const;
}

function cycleNotes(task: ReopenTotal, reasons: ReportExportProps["reasons"]) {
  return task.cycles
    .map((cycle) => {
      const sentBack = reasons[`${task.taskId}:${cycle.cycle}`];
      const lines = [
        `Reopen ${cycle.cycle} (${formatDuration(cycle.minutes)})${sentBack ? ` by ${sentBack.by}` : ""}`,
      ];

      if (sentBack?.reason) {
        lines.push(`Reason: ${sentBack.reason}`);
      }

      for (const entry of cycle.notes) {
        lines.push(
          `${entry.personName} ${formatDuration(entry.minutes)}${entry.note ? `: ${entry.note}` : ""}`
        );
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

/* ------------------------------------------------------------------ */
/* Excel                                                                */
/* ------------------------------------------------------------------ */

async function exportExcel(props: ReportExportProps) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Digiart Creation";
  workbook.created = new Date();

  type Sheet = ReturnType<typeof workbook.addWorksheet>;

  const styleHeader = (sheet: Sheet, rowNumber: number) => {
    const row = sheet.getRow(rowNumber);
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND}` } };
      cell.alignment = { vertical: "middle" };
    });
    row.height = 20;
  };

  const addTitle = (sheet: Sheet, title: string, span: number) => {
    sheet.mergeCells(1, 1, 1, span);
    sheet.getCell(1, 1).value = title;
    sheet.getCell(1, 1).font = { bold: true, size: 14, color: { argb: `FF${BRAND}` } };
    sheet.mergeCells(2, 1, 2, span);
    sheet.getCell(2, 1).value = `${props.scope} · Generated ${generatedOn()}`;
    sheet.getCell(2, 1).font = { italic: true, color: { argb: "FF6B7280" } };
  };

  // Summary
  const summary = workbook.addWorksheet("Summary");
  summary.columns = [{ width: 28 }, { width: 18 }, { width: 14 }];
  addTitle(summary, props.heading, 3);
  summary.addRow([]);
  summary.addRow(["Measure", "Value", "Hours"]);
  styleHeader(summary, 4);
  for (const [label, value, hoursValue] of kpiRows(props.analytics)) {
    const row = summary.addRow([label, value, hoursValue]);
    row.getCell(3).numFmt = "0.00";
  }

  // Breakdown
  const breakdownHeadings = [
    props.groupHeading.split(" / ")[0],
    "Task",
    ...props.detailHeadings,
    ...(props.showPeople ? ["People"] : []),
    "Time",
    "Hours",
    "Rework hours",
    "Reopens",
  ];
  const breakdown = workbook.addWorksheet("Breakdown", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  addTitle(breakdown, `${props.heading} – breakdown`, breakdownHeadings.length);
  breakdown.addRow([]);
  breakdown.addRow(breakdownHeadings);
  styleHeader(breakdown, 4);
  breakdown.columns = breakdownHeadings.map((heading, index) => ({
    width: index < 2 ? 32 : heading === "People" ? 30 : 16,
  }));
  const hoursColumn = breakdownHeadings.indexOf("Hours") + 1;

  for (const group of props.groups) {
    const groupRow = breakdown.addRow([
      group.label,
      `${group.tasks.length} ${group.tasks.length === 1 ? "task" : "tasks"}`,
      ...props.detailHeadings.map(() => ""),
      ...(props.showPeople ? [""] : []),
      formatDuration(group.minutes),
      decimalHours(group.minutes),
      decimalHours(group.reopenMinutes),
      "",
    ]);
    groupRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: `FF${BRAND}` } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_TINT}` } };
    });

    for (const task of group.tasks) {
      breakdown.addRow([
        "",
        task.title,
        ...task.details.map((detail) => detail ?? "Not mapped"),
        ...(props.showPeople
          ? [task.people.map((person) => `${person.name} (${formatDuration(person.minutes)})`).join(", ")]
          : []),
        formatDuration(task.minutes),
        decimalHours(task.minutes),
        decimalHours(task.reopenMinutes),
        task.reopenCount,
      ]);
    }
  }
  breakdown.getColumn(hoursColumn).numFmt = "0.00";
  breakdown.getColumn(hoursColumn + 1).numFmt = "0.00";

  // Trend
  const trend = workbook.addWorksheet("Trend");
  trend.columns = [{ width: 18 }, { width: 16 }, { width: 16 }, { width: 16 }];
  addTitle(trend, `Hours ${props.analytics.granularity === "day" ? "per day" : `per ${props.analytics.granularity}`}`, 4);
  trend.addRow([]);
  trend.addRow(["Period", "First pass (h)", "Rework (h)", "Total (h)"]);
  styleHeader(trend, 4);
  for (const bucket of props.analytics.trend) {
    trend.addRow([
      bucket.label,
      decimalHours(bucket.firstPass),
      decimalHours(bucket.rework),
      decimalHours(bucket.firstPass + bucket.rework),
    ]);
  }
  [2, 3, 4].forEach((column) => (trend.getColumn(column).numFmt = "0.00"));

  // Reopened tasks
  const reopened = workbook.addWorksheet("Reopened tasks");
  reopened.columns = [
    { width: 32 },
    { width: 24 },
    { width: 10 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 60 },
  ];
  addTitle(reopened, "Reopened tasks", 7);
  reopened.addRow([]);
  reopened.addRow(["Task", "Client", "Reopens", "Original (h)", "Rework (h)", "Total (h)", "Reopen history"]);
  styleHeader(reopened, 4);
  for (const task of props.reopened) {
    const row = reopened.addRow([
      task.title,
      task.client,
      task.reopenCount,
      decimalHours(task.originalMinutes),
      decimalHours(task.reopenMinutes),
      decimalHours(task.minutes),
      cycleNotes(task, props.reasons),
    ]);
    row.getCell(7).alignment = { wrapText: true, vertical: "top" };
    row.alignment = { vertical: "top" };
  }
  [4, 5, 6].forEach((column) => (reopened.getColumn(column).numFmt = "0.00"));

  // Raw entries
  const entries = workbook.addWorksheet("Time entries", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  entries.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Employee", key: "employee", width: 22 },
    { header: "Client", key: "client", width: 24 },
    { header: "Service", key: "service", width: 22 },
    { header: "Work", key: "work", width: 30 },
    { header: "Task", key: "task", width: 32 },
    { header: "Hours", key: "hours", width: 10 },
    { header: "Time", key: "time", width: 10 },
    { header: "Run", key: "run", width: 12 },
    { header: "Note", key: "note", width: 40 },
  ];
  styleHeader(entries, 1);
  for (const entry of props.analytics.entries) {
    entries.addRow({
      ...entry,
      hours: decimalHours(entry.minutes),
      time: formatDuration(entry.minutes),
      run: entry.cycle > 0 ? `Reopen ${entry.cycle}` : "First pass",
    });
  }
  entries.getColumn("hours").numFmt = "0.00";
  entries.autoFilter = { from: "A1", to: "J1" };

  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${props.fileStem}.xlsx`
  );
}

/* ------------------------------------------------------------------ */
/* PDF                                                                  */
/* ------------------------------------------------------------------ */

type ChartImage = { uri: string; width: number; height: number };

async function chartImage(id: string): Promise<ChartImage | null> {
  const { default: ApexCharts } = await import("apexcharts");

  try {
    const result = await ApexCharts.exec(id, "dataURI", { scale: 2 });
    const uri = result?.imgURI as string | undefined;

    if (!uri) {
      return null;
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = uri;
    });

    // Re-encoded as JPEG on white: the PNGs Apex hands back are several MB
    // each, which made the PDF far too heavy to email.
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);

    return {
      uri: canvas.toDataURL("image/jpeg", 0.88),
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    // A chart switched to its table view is not on the page to photograph.
    return null;
  }
}

async function exportPdf(props: ReportExportProps) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const violet: [number, number, number] = [119, 15, 194];
  const ink: [number, number, number] = [31, 41, 55];
  const muted: [number, number, number] = [107, 114, 128];

  // Header band
  doc.setFillColor(...violet);
  doc.rect(0, 0, pageWidth, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(props.heading, margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Digiart Creation · ${props.scope}`, margin, 19);
  doc.text(`Generated ${generatedOn()}`, pageWidth - margin, 19, { align: "right" });

  // KPI tiles
  const { kpis } = props.analytics;
  const tiles = [
    ["Total time", formatDuration(kpis.total)],
    ["First pass", formatDuration(kpis.firstPass)],
    ["Rework", formatDuration(kpis.rework)],
    ["Rework rate", `${kpis.reworkRate.toFixed(1)}%`],
    ["Tasks", String(kpis.tasks)],
    ["Employees", String(kpis.employees)],
  ];
  const gap = 4;
  const tileWidth = (contentWidth - gap * (tiles.length - 1)) / tiles.length;
  let y = 32;

  tiles.forEach(([label, value], index) => {
    const x = margin + index * (tileWidth + gap);
    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(250, 249, 252);
    doc.roundedRect(x, y, tileWidth, 18, 2, 2, "FD");
    doc.setTextColor(...muted);
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + 4, y + 6);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(value, x + 4, y + 14);
    doc.setFont("helvetica", "normal");
  });
  y += 24;

  // Charts, fitted into a box while keeping their proportions
  const placeChart = (
    image: ChartImage | null,
    title: string,
    x: number,
    top: number,
    width: number,
    maxHeight: number
  ) => {
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, x, top + 4);
    doc.setFont("helvetica", "normal");

    if (!image) {
      doc.setTextColor(...muted);
      doc.setFontSize(8);
      doc.text("Chart hidden (table view) or no data.", x, top + 10);
      return top + 14;
    }

    const scale = Math.min(width / image.width, (maxHeight - 7) / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    doc.addImage(image.uri, "JPEG", x, top + 7, drawWidth, drawHeight);

    return top + 7 + drawHeight;
  };

  const [trend, rework, ranking, mix, weekday, reopen] = await Promise.all([
    chartImage(CHART_IDS.trend),
    chartImage(CHART_IDS.rework),
    chartImage(CHART_IDS.ranking),
    chartImage(CHART_IDS.mix),
    chartImage(CHART_IDS.weekday),
    chartImage(CHART_IDS.reopen),
  ]);

  const wide = contentWidth * 0.66;
  const narrow = contentWidth - wide - 6;
  const rowHeight = pageHeight - y - margin;

  const left = placeChart(trend, "Hours over time", margin, y, wide, rowHeight);
  const right = placeChart(rework, `Rework rate – ${kpis.reworkRate.toFixed(1)}%`, margin + wide + 6, y, narrow, rowHeight);
  y = Math.max(left, right);

  doc.addPage();
  y = margin;
  const rowTwo = (pageHeight - margin * 2) / 2;
  const leftTwo = placeChart(ranking, "Where the time went", margin, y, wide, rowTwo);
  const mixX = margin + wide + 6;
  // The on-screen donut legend is HTML, so the PDF writes its own.
  let rightTwo = placeChart(mix, props.analytics.share.title, mixX, y, narrow, rowTwo - 30) + 3;
  const mixTotal = props.analytics.kpis.total;
  const mixColors = ["#770FC2", "#2A78D6", "#EB6834", "#1BAF7A", "#EDA100", "#E87BA4"];
  doc.setFontSize(7.5);
  props.analytics.share.slices.forEach((slice, index) => {
    const color = slice.label.startsWith("Other (") ? "#B8B6B0" : mixColors[index % mixColors.length];
    doc.setFillColor(color);
    doc.rect(mixX, rightTwo - 2, 2.5, 2.5, "F");
    doc.setTextColor(...ink);
    doc.text(slice.label, mixX + 4, rightTwo);
    const share = mixTotal > 0 ? Math.round((slice.minutes / mixTotal) * 100) : 0;
    doc.text(`${formatDuration(slice.minutes)}  ${share}%`, mixX + narrow, rightTwo, { align: "right" });
    rightTwo += 4.2;
  });
  y = Math.max(leftTwo, rightTwo) + 4;
  const leftThree = placeChart(weekday, "Weekly rhythm", margin, y, wide, pageHeight - y - margin);
  const rightThree = placeChart(reopen, "Cost of rework", margin + wide + 6, y, narrow, pageHeight - y - margin);
  y = Math.max(leftThree, rightThree);

  // Breakdown table
  doc.addPage();
  const head = [
    props.groupHeading,
    ...props.detailHeadings,
    ...(props.showPeople ? ["People"] : []),
    "Time",
    "Rework",
  ];
  const body: { content: string; styles?: Record<string, unknown> }[][] = [];

  for (const group of props.groups) {
    const groupStyle = { fontStyle: "bold", fillColor: [243, 232, 255], textColor: violet };
    body.push([
      { content: group.label, styles: groupStyle },
      ...props.detailHeadings.map(() => ({ content: "", styles: groupStyle })),
      ...(props.showPeople ? [{ content: "", styles: groupStyle }] : []),
      { content: formatDuration(group.minutes), styles: groupStyle },
      { content: group.reopenMinutes > 0 ? formatDuration(group.reopenMinutes) : "–", styles: groupStyle },
    ]);

    for (const task of group.tasks) {
      body.push([
        { content: `   ${task.title}${task.reopenCount > 0 ? ` (reopened ${task.reopenCount}x)` : ""}` },
        ...task.details.map((detail) => ({ content: detail ?? "Not mapped" })),
        ...(props.showPeople
          ? [{ content: task.people.map((person) => `${person.name} ${formatDuration(person.minutes)}`).join("\n") }]
          : []),
        { content: formatDuration(task.minutes) },
        { content: task.reopenMinutes > 0 ? formatDuration(task.reopenMinutes) : "–" },
      ]);
    }
  }

  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Detailed breakdown", margin, margin + 2);

  autoTable(doc, {
    startY: margin + 6,
    margin: { left: margin, right: margin },
    head: [head],
    body,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, lineColor: [229, 231, 235], lineWidth: 0.2, textColor: ink },
    headStyles: { fillColor: violet, textColor: 255, fontStyle: "bold" },
    columnStyles: {
      [head.length - 2]: { halign: "right" },
      [head.length - 1]: { halign: "right" },
    },
  });

  if (props.reopened.length > 0) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Reopened tasks", margin, margin + 2);

    autoTable(doc, {
      startY: margin + 6,
      margin: { left: margin, right: margin },
      head: [["Task", "Client", "Reopens", "Original", "Rework", "Total", "History"]],
      body: props.reopened.map((task) => [
        task.title,
        task.client,
        String(task.reopenCount),
        formatDuration(task.originalMinutes),
        formatDuration(task.reopenMinutes),
        formatDuration(task.minutes),
        cycleNotes(task, props.reasons),
      ]),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, lineColor: [229, 231, 235], lineWidth: 0.2, textColor: ink, valign: "top" },
      headStyles: { fillColor: violet, textColor: 255, fontStyle: "bold" },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { cellWidth: 95 },
      },
    });
  }

  // Page numbers on every page
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`${props.heading} · Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 5, {
      align: "right",
    });
  }

  doc.save(`${props.fileStem}.pdf`);
}

/* ------------------------------------------------------------------ */
/* Buttons                                                              */
/* ------------------------------------------------------------------ */

function SheetIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M3 8h14M3 12.5h14M8 3v14" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 2.5h7l3.5 3.5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" />
      <path d="M12 2.5V6h3.5M7 11h6M7 14h4" />
    </svg>
  );
}

export default function ReportExport(props: ReportExportProps) {
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "excel" | "pdf") {
    setBusy(kind);
    setError(null);

    try {
      await (kind === "excel" ? exportExcel(props) : exportPdf(props));
    } catch (exportError) {
      console.error(exportError);
      setError("Export failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const buttonClass =
    "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium shadow-sm transition disabled:cursor-wait disabled:opacity-60";

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => run("excel")}
          disabled={busy !== null}
          className={`${buttonClass} border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50`}
        >
          <SheetIcon />
          {busy === "excel" ? "Preparing..." : "Export Excel"}
        </button>
        <button
          type="button"
          onClick={() => run("pdf")}
          disabled={busy !== null}
          className={`${buttonClass} bg-[#770FC2] text-white hover:bg-[#6B1BBD]`}
        >
          <PdfIcon />
          {busy === "pdf" ? "Preparing..." : "Export PDF"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
