"use client";

import { useState } from "react";
import { formatOfficeDate } from "@/lib/officeTime";
import {
  formatCount,
  quantityLabel,
  rateLabel,
  tasksLabel,
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

/* ------------------------------------------------------------------ */
/* Excel                                                                */
/* ------------------------------------------------------------------ */

async function exportExcel({ scope, fileStem, report, notes }: ServiceCountExportProps) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Digiart Creation";
  workbook.created = new Date();

  type Sheet = ReturnType<typeof workbook.addWorksheet>;
  type Row = ReturnType<Sheet["addRow"]>;

  const addTitle = (sheet: Sheet, title: string, span: number) => {
    sheet.mergeCells(1, 1, 1, span);
    sheet.getCell(1, 1).value = title;
    sheet.getCell(1, 1).font = { bold: true, size: 14, color: { argb: `FF${BRAND}` } };
    sheet.mergeCells(2, 1, 2, span);
    sheet.getCell(2, 1).value = `${scope} · Generated ${generatedOn()}`;
    sheet.getCell(2, 1).font = { italic: true, color: { argb: "FF6B7280" } };
    sheet.addRow([]);
  };

  const styleHeader = (row: Row) => {
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND}` } };
      cell.alignment = { vertical: "middle" };
    });
    row.height = 20;
  };

  const styleTotal = (row: Row) => {
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: `FF${BRAND}` } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_TINT}` } };
    });
  };

  // Summary: count × rate = amount, per client
  const headings = ["Client", "Service", "Count", "Tasks", "Rate", "Amount"];
  const sheet = workbook.addWorksheet(HEADING, { views: [{ state: "frozen", ySplit: 4 }] });
  sheet.columns = [{ width: 30 }, { width: 20 }, { width: 14 }, { width: 8 }, { width: 30 }, { width: 16 }];
  addTitle(sheet, HEADING, headings.length);
  styleHeader(sheet.addRow(headings));

  for (const client of report.clients) {
    client.lines.forEach((line, index) => {
      const row = sheet.addRow([
        index === 0 ? client.name : "",
        line.service,
        // DM is an amount, the others a count; both stay numbers for Excel.
        line.quantity,
        line.tasks.length,
        rateLabel(line),
        line.amount,
      ]);

      row.getCell(3).numFmt = line.service === "Digital Marketing" ? '"₹"#,##0' : "0.##";
    });

    styleTotal(sheet.addRow([`${client.name} total`, "", "", "", "", client.total]));
  }

  sheet.addRow([]);
  styleTotal(sheet.addRow([`Total · ${scope}`, "", "", "", "", report.total]));
  sheet.getColumn(6).numFmt = '"₹"#,##0';
  sheet.addRow([]);

  for (const note of notes) {
    const row = sheet.addRow([note]);
    sheet.mergeCells(row.number, 1, row.number, headings.length);
    row.getCell(1).font = { italic: true, color: { argb: "FF6B7280" } };
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
    row.height = 30;
  }

  // Every task behind the counts
  const tasks = workbook.addWorksheet("Tasks", { views: [{ state: "frozen", ySplit: 4 }] });
  tasks.columns = [{ width: 30 }, { width: 20 }, { width: 44 }, { width: 14 }, { width: 16 }];
  addTitle(tasks, `${HEADING} – tasks`, 5);
  styleHeader(tasks.addRow(["Client", "Service", "Task", "Count", "Completed on"]));

  for (const client of report.clients) {
    for (const line of client.lines) {
      for (const task of line.tasks) {
        const row = tasks.addRow([
          client.name,
          line.service,
          task.title,
          task.quantity,
          formatOfficeDate(task.completedAt),
        ]);
        row.getCell(4).numFmt = line.service === "Digital Marketing" ? '"₹"#,##0' : "0.##";
      }
    }
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
  const tint: [number, number, number] = [243, 232, 255];
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
  const { byService } = report;
  const tiles = [
    ["Videos", `${formatCount(byService["Video Editing"].quantity)} (${tasksLabel(byService["Video Editing"].tasks)})`],
    ["Posters", `${byService["Poster Design"].quantity} (${tasksLabel(byService["Poster Design"].tasks)})`],
    ["DM amount", pdfText(formatInr(byService["Digital Marketing"].quantity))],
    ["Total amount", pdfText(formatInr(report.total))],
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
    doc.setFontSize(12);
    doc.text(value, x + 4, tileTop + 14);
    doc.setFont("helvetica", "normal");
  });

  type Cell = { content: string; styles?: Record<string, unknown> };
  const totalStyle = { fontStyle: "bold", fillColor: tint, textColor: violet };
  const body: Cell[][] = [];

  for (const client of report.clients) {
    client.lines.forEach((line, index) => {
      body.push([
        { content: index === 0 ? client.name : "" },
        { content: line.service },
        { content: `${pdfText(quantityLabel(line.service, line.quantity))} (${tasksLabel(line.tasks.length)})` },
        { content: pdfText(rateLabel(line)) },
        { content: line.amount === null ? "–" : pdfText(formatInr(line.amount)) },
      ]);
    });

    body.push([
      { content: `${client.name} total`, styles: totalStyle },
      { content: "", styles: totalStyle },
      { content: "", styles: totalStyle },
      { content: "", styles: totalStyle },
      { content: pdfText(formatInr(client.total)), styles: totalStyle },
    ]);
  }

  autoTable(doc, {
    startY: tileTop + 24,
    margin: { left: margin, right: margin },
    head: [["Client", "Service", "Count", "× Rate", "Amount"]],
    body,
    // columnStyles skip the foot, so its figure is right-aligned here.
    foot: [
      [
        { content: `Total · ${scope}` },
        { content: "" },
        { content: "" },
        { content: "" },
        { content: pdfText(formatInr(report.total)), styles: { halign: "right" } },
      ],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.2, lineColor: [229, 231, 235], lineWidth: 0.2, textColor: ink },
    headStyles: { fillColor: violet, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: violet, textColor: 255, fontStyle: "bold" },
    columnStyles: { 4: { halign: "right" } },
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
  const empty = props.report.clients.length === 0;

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
