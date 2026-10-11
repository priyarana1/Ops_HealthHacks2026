/**
 * "Discharge Progress" PDF for the patient app: today's to-do progress, the plan summary,
 * appointments and warning signs. Built in the browser with jsPDF (loaded on demand) from what
 * the patient app already shows; nothing is sent to the server.
 */

export interface ProgressReport {
  fileName: string;
  labels: {
    title: string; patient: string; hospital: string; generated: string; accessUntil: string;
    progress: string; done: string; stopped: string; appointments: string; scheduled: string;
    history: string; daysTracked: string; tasksCompleted: string; day: string; date: string; tasks: string; progressColumn: string; cumulativeNote: string;
  };
  patient: string;
  hospital: string;
  generated: string;
  accessUntil: string;
  progress: { completed: number; total: number; items: { label: string; done: boolean; detail?: string }[] };
  /** One row per day the app was used since discharge, oldest first (cumulative). */
  history: { day: string; date: string; completed: number; total: number }[];
  whyTitle: string;
  why: string;
  medicineGroups: { title: string; rows: { name: string; dose?: string; schedule?: string }[] }[];
  stopped: { name: string; note?: string }[];
  appointments: { title: string; when?: string; clinic?: string; location?: string; phone?: string }[];
  warnings: { title: string; urgent: boolean; items: string[] }[];
}

const NAVY: [number, number, number] = [23, 42, 79];
const MUTED: [number, number, number] = [90, 98, 110];
const RED: [number, number, number] = [179, 38, 62];
const GREEN: [number, number, number] = [79, 138, 98];

// The PDF's built-in fonts cover Western European text only; map typographic characters and drop the rest.
function clean(text: string) {
  return text
    .replace(/[   ]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E¡-ÿ]/g, "");
}

async function logoDataUrl(): Promise<string | null> {
  try {
    const blob = await (await fetch("/brand/clearpath-mark.png")).blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Builds the report. `logo` defaults to the ClearPath mark served by the app. */
export async function buildProgressPdf(report: ProgressReport, logo?: string | null) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth(), pageHeight = doc.internal.pageSize.getHeight();
  const margin = 54, width = pageWidth - margin * 2;
  let y = margin;

  const ensure = (height: number) => {
    if (y + height > pageHeight - margin) { doc.addPage(); y = margin; }
  };
  const text = (value: string, options: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number; gap?: number } = {}) => {
    const { size = 10.5, bold = false, color = [35, 31, 26], indent = 0, gap = 4 } = options;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines: string[] = doc.splitTextToSize(clean(value), width - indent);
    const lineHeight = size * 1.35;
    for (const line of lines) {
      ensure(lineHeight);
      doc.text(line, margin + indent, y + size);
      y += lineHeight;
    }
    y += gap;
  };
  // `keepWith`: space for the first item, so a heading never ends a page on its own.
  const heading = (value: string, keepWith = 40) => {
    ensure(40 + keepWith);
    y += 10;
    text(value, { size: 13, bold: true, color: NAVY, gap: 2 });
    doc.setDrawColor(220, 226, 234);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  };
  const checkbox = (done: boolean) => {
    const size = 10, top = y + 1.5;
    doc.setDrawColor(...(done ? GREEN : MUTED));
    doc.setLineWidth(1);
    doc.rect(margin, top, size, size);
    if (done) {
      doc.setLineWidth(1.6);
      doc.line(margin + 2, top + 5.5, margin + 4.3, top + 8);
      doc.line(margin + 4.3, top + 8, margin + 8.5, top + 2);
    }
    doc.setLineWidth(1);
  };

  // Header: logo, title, patient details.
  if (logo === undefined) logo = await logoDataUrl();
  if (logo) doc.addImage(logo, "PNG", margin, y, 40, 36);
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...NAVY);
  doc.text("ClearPath", margin + (logo ? 50 : 0), y + 24);
  y += 52;
  text(report.labels.title, { size: 20, bold: true, color: NAVY, gap: 6 });
  text(`${report.labels.patient}: ${report.patient}`, { gap: 1 });
  text(`${report.labels.hospital}: ${report.hospital}`, { gap: 1 });
  text(`${report.labels.generated}: ${report.generated}`, { gap: 1 });
  text(`${report.labels.accessUntil}: ${report.accessUntil}`, { color: MUTED });

  // Cumulative progress: one row per day of use.
  const allDone = report.history.reduce((n, d) => n + d.completed, 0), allTasks = report.history.reduce((n, d) => n + d.total, 0);
  heading(report.labels.history, 110);
  text(`${report.labels.daysTracked}: ${report.history.length}   ·   ${report.labels.tasksCompleted}: ${allDone} / ${allTasks}${allTasks ? ` (${Math.round((allDone / allTasks) * 100)}%)` : ""}`, { bold: true, gap: 8 });
  const columns = [{ label: report.labels.day, x: margin + 8 }, { label: report.labels.date, x: margin + 80 }, { label: report.labels.tasks, x: margin + 290 }, { label: report.labels.progressColumn, x: margin + 370 }];
  const row = (cells: string[], header: boolean) => {
    ensure(26);
    doc.setFillColor(...(header ? [232, 238, 245] as [number, number, number] : [255, 255, 255] as [number, number, number]));
    doc.setDrawColor(220, 226, 234);
    doc.rect(margin, y, width, 24, header ? "FD" : "S");
    doc.setFont("helvetica", header ? "bold" : "normal"); doc.setFontSize(10); doc.setTextColor(...(header ? NAVY : [35, 31, 26] as [number, number, number]));
    cells.forEach((cell, i) => doc.text(clean(cell), columns[i].x, y + 16));
  };
  row(columns.map((c) => c.label), true);
  y += 24;
  for (const d of report.history) {
    row([d.day, d.date, `${d.completed} / ${d.total}`, ""], false);
    // Progress bar in the last column.
    const barX = columns[3].x, barW = width - (barX - margin) - 12, share = d.total ? d.completed / d.total : 0;
    doc.setFillColor(226, 232, 240); doc.roundedRect(barX, y + 8, barW, 8, 4, 4, "F");
    if (share > 0) { doc.setFillColor(...GREEN); doc.roundedRect(barX, y + 8, Math.max(8, barW * share), 8, 4, 4, "F"); }
    y += 24;
  }
  y += 8;
  text(report.labels.cumulativeNote, { size: 9.5, color: MUTED, gap: 4 });

  // Today's checklist.
  heading(`${report.labels.progress} - ${report.progress.completed} / ${report.progress.total} ${report.labels.done}`);
  for (const item of report.progress.items) {
    ensure(16);
    checkbox(item.done);
    text(item.label, { indent: 18, gap: item.detail ? 0 : 3, bold: item.done });
    if (item.detail) text(item.detail, { indent: 18, size: 9.5, color: MUTED, gap: 3 });
  }

  // Plan summary.
  heading(report.whyTitle);
  text(report.why);
  for (const group of report.medicineGroups) {
    if (!group.rows.length) continue;
    heading(group.title);
    for (const row of group.rows) {
      ensure(40); // keep a medicine's name and schedule together
      text(`${row.name}${row.dose ? ` - ${row.dose}` : ""}`, { bold: true, gap: 0 });
      if (row.schedule) text(row.schedule, { color: MUTED, gap: 4 });
      else y += 4;
    }
  }
  if (report.stopped.length) {
    heading(report.labels.stopped);
    for (const row of report.stopped) {
      text(row.name, { bold: true, color: RED, gap: 0 });
      if (row.note) text(row.note, { gap: 4 });
    }
  }

  // Appointments and warning signs.
  if (report.appointments.length) {
    heading(report.labels.appointments, 100);
    for (const a of report.appointments) {
      ensure(100); // keep each appointment on one page
      text(a.title, { bold: true, gap: 0 });
      if (a.when) text(`${report.labels.scheduled}: ${a.when}`, { gap: 0 });
      for (const line of [a.clinic, a.location, a.phone]) if (line) text(line, { color: MUTED, gap: 0 });
      y += 6;
    }
  }
  for (const zone of report.warnings) {
    heading(zone.title);
    for (const item of zone.items) text(`- ${item}`, { color: zone.urgent ? RED : [35, 31, 26], gap: 2 });
  }

  // Page numbers.
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text(`ClearPath - ${clean(report.patient)} - ${page} / ${pages}`, pageWidth / 2, pageHeight - 28, { align: "center" });
  }
  return doc;
}

export async function downloadProgressPdf(report: ProgressReport) {
  (await buildProgressPdf(report)).save(report.fileName);
}
