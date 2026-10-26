"use client";

import { useState } from "react";
import {
  formatCount,
  formatProfitPercent,
  type ServiceCountReport,
} from "@/lib/serviceCounts";
import { formatInr } from "@/lib/services";

type ServiceCountExportProps = {
  /** "Oct-2026", "All time", "1 Oct 2026 – 15 Oct 2026". */
  scope: string;
  fileStem: string;
  report: ServiceCountReport;
  /** The page's footnotes, repeated under the exported table. */
  notes: string[];
};

const HEADING = "Services Count";
const BRAND = "770FC2";
const BRAND_TINT = "F3E8FF";

const HEADINGS = [
  "Client",
  "Videos",
  "Video weightage",
  "Posters",
  "DM amount",
  "Income",
  "Cost",
  "Profit",
  "Profit %",
];

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

/** The table's rows and its totals, as plain values both formats start from. */
function tableLines(report: ServiceCountReport) {
  return [
    ...report.rows.map((row) => ({ ...row, total: false })),
    { ...report.totals, name: "Total", total: true },
  ].map((line) => ({
    name: line.name,
    videos: line.videos,
    videoWeightage: line.videoWeightage,
    posters: line.posters,
    dmAmount: line.dmAmount,
    income: line.income,
    cost: line.cost,
    profit: line.income === null || line.cost === null ? null : line.income - line.cost,
    profitPercent: line.profitPercent,
    total: line.total,
  }));
}

/* ------------------------------------------------------------------ */
/* Excel                                                                */
/* ------------------------------------------------------------------ */

async function exportExcel({ scope, fileStem, report, notes }: ServiceCountExportProps) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Digiart Creation";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(HEADING, {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  sheet.columns = [
    { width: 32 },
    { width: 10 },
    { width: 16 },
    { width: 10 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 12 },
  ];

  sheet.mergeCells(1, 1, 1, HEADINGS.length);
  sheet.getCell(1, 1).value = HEADING;
  sheet.getCell(1, 1).font = { bold: true, size: 14, color: { argb: `FF${BRAND}` } };
  sheet.mergeCells(2, 1, 2, HEADINGS.length);
  sheet.getCell(2, 1).value = `${scope} · Generated ${generatedOn()}`;
  sheet.getCell(2, 1).font = { italic: true, color: { argb: "FF6B7280" } };
  sheet.addRow([]);

  const header = sheet.addRow(HEADINGS);
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND}` } };
    cell.alignment = { vertical: "middle" };
  });
  header.height = 20;

  for (const line of tableLines(report)) {
    const row = sheet.addRow([
      line.name,
      line.videos,
      line.videoWeightage,
      line.posters,
      line.dmAmount,
      line.income,
      line.cost,
      line.profit,
      // Stored as a fraction so Excel's percent format reads it right.
      line.profitPercent === null ? null : line.profitPercent / 100,
    ]);

    if (line.total) {
      row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: `FF${BRAND}` } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_TINT}` } };
      });
    }
  }

  sheet.getColumn(3).numFmt = "0.0";
  [5, 6, 7, 8].forEach((column) => (sheet.getColumn(column).numFmt = '"₹"#,##0;-"₹"#,##0'));
  sheet.getColumn(9).numFmt = "0.0%";

  sheet.addRow([]);

  for (const note of notes) {
    const row = sheet.addRow([note]);
    sheet.mergeCells(row.number, 1, row.number, HEADINGS.length);
    row.getCell(1).font = { italic: true, color: { argb: "FF6B7280" } };
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
    row.height = 30;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${fileStem}.xlsx`
  );
}

/* ------------------------------------------------------------------ */
/* PDF                                                                  */
/* ------------------------------------------------------------------ */

/**
 * jsPDF's built-in fonts only cover Latin-1: a character outside it, like the
 * rupee sign or a typographic minus, garbles the whole line. So the PDF
 * writes "Rs." and a plain hyphen.
 */
function pdfText(text: string) {
  return text.replace(/₹/g, "Rs. ").replace(/−/g, "-");
}

function pdfInr(amount: number) {
  return pdfText(formatInr(amount));
}

async function exportPdf({ scope, fileStem, report, notes }: ServiceCountExportProps) {
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
  doc.text(HEADING, margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Digiart Creation · ${scope}`, margin, 19);
  doc.text(`Generated ${generatedOn()}`, pageWidth - margin, 19, { align: "right" });

  // KPI tiles
  const { totals } = report;
  const tiles = [
    ["Videos", `${totals.videos} (weightage ${formatCount(totals.videoWeightage)})`],
    ["Posters", String(totals.posters)],
    ["DM amount", pdfInr(totals.dmAmount)],
    ["Income", pdfInr(totals.income)],
    ["Cost", pdfInr(totals.cost)],
    ["Profit", totals.profitPercent === null ? "–" : formatProfitPercent(totals.profitPercent)],
  ];
  const gap = 4;
  const tileWidth = (contentWidth - gap * (tiles.length - 1)) / tiles.length;
  const tileTop = 32;

  tiles.forEach(([label, value], index) => {
    const x = margin + index * (tileWidth + gap);
    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(250, 249, 252);
    doc.roundedRect(x, tileTop, tileWidth, 18, 2, 2, "FD");
    doc.setTextColor(...muted);
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + 4, tileTop + 6);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(value, x + 4, tileTop + 14);
    doc.setFont("helvetica", "normal");
  });

  const lines = tableLines(report);
  const cell = (line: (typeof lines)[number]) => [
    line.name,
    String(line.videos),
    formatCount(line.videoWeightage),
    String(line.posters),
    // A dash for no DM work, as on the page; the total always shows its sum.
    line.total || line.dmAmount > 0 ? pdfInr(line.dmAmount) : "–",
    line.income === null ? "–" : pdfInr(line.income),
    line.cost === null ? "–" : pdfInr(line.cost),
    line.profit === null ? "–" : pdfInr(line.profit),
    line.profitPercent === null ? "–" : formatProfitPercent(line.profitPercent),
  ];

  autoTable(doc, {
    startY: tileTop + 24,
    margin: { left: margin, right: margin },
    head: [HEADINGS],
    body: lines.filter((line) => !line.total).map(cell),
    // columnStyles skip the foot, so its figures are right-aligned here.
    foot: [
      cell(lines[lines.length - 1]).map((content, index) => ({
        content,
        styles: index === 0 ? {} : { halign: "right" as const },
      })),
    ],
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2, lineColor: [229, 231, 235], lineWidth: 0.2, textColor: ink },
    headStyles: { fillColor: violet, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [243, 232, 255], textColor: violet, fontStyle: "bold" },
    columnStyles: Object.fromEntries(
      HEADINGS.slice(1).map((_, index) => [index + 1, { halign: "right" }])
    ),
    showFoot: "lastPage",
  });

  // Notes under the table
  const tableEnd = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  let y = (tableEnd ?? tileTop + 24) + 8;
  doc.setFontSize(8);
  doc.setTextColor(...muted);

  for (const note of notes) {
    const wrapped = doc.splitTextToSize(pdfText(note), contentWidth) as string[];

    if (y + wrapped.length * 4 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    doc.text(wrapped, margin, y);
    y += wrapped.length * 4 + 2;
  }

  // Page numbers on every page
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`${HEADING} · Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 5, {
      align: "right",
    });
  }

  doc.save(`${fileStem}.pdf`);
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

export default function ServiceCountExport(props: ServiceCountExportProps) {
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const empty = props.report.rows.length === 0;

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
    "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => run("excel")}
          disabled={busy !== null || empty}
          className={`${buttonClass} border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50`}
        >
          <SheetIcon />
          {busy === "excel" ? "Preparing..." : "Export Excel"}
        </button>
        <button
          type="button"
          onClick={() => run("pdf")}
          disabled={busy !== null || empty}
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
