import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";
import { buildProgressPdf, type ProgressReport } from "../src/lib/progress-pdf";

const report: ProgressReport = {
  fileName: "ClearPath-Discharge-Progress-Walter-2026-10-11.pdf",
  labels: { title: "Discharge Progress", patient: "Patient", hospital: "Hospital", generated: "Report date", accessUntil: "Plan available until", progress: "Today's progress", done: "done", stopped: "Do not take these", appointments: "Appointments", scheduled: "Scheduled", history: "Progress since discharge", daysTracked: "Days tracked", tasksCompleted: "Tasks completed", day: "Day", date: "Date", tasks: "Done", progressColumn: "Progress", cumulativeNote: "This report is cumulative: each day you use ClearPath adds a new row." },
  patient: "Walter Brennan", hospital: "Robert Wood Johnson University Hospital - New Brunswick", generated: "Sunday, October 11, 2026", accessUntil: "Sunday, November 8, 2026",
  progress: { completed: 2, total: 3, items: [{ label: "Weigh yourself", done: true }, { label: "Morning medicines (8 AM)", done: true, detail: "Taken: Furosemide, Losartan" }, { label: "Night medicines (8 PM)", done: false, detail: "Not yet: Apixaban, Metformin" }] },
  history: [{ day: "Day 1", date: "Sun, October 11", completed: 2, total: 3 }],
  whyTitle: "Why you were in the hospital", why: "Your heart was not pumping well. Extra fluid made it hard to breathe.",
  medicineGroups: [{ title: "New medicines", rows: [{ name: "Furosemide", dose: "40 mg · 1 pill", schedule: "Once Daily · By Mouth" }, { name: "Amoxicillin-clavulanate", dose: "875/125 mg · 1 pill", schedule: "Twice Daily for 3 Additional Days · By Mouth" }] }],
  stopped: [{ name: "Lisinopril", note: "Stop taking this. Losartan takes its place." }],
  appointments: [{ title: "Blood test appointment", when: "Wednesday, October 14 · 9:00 AM", clinic: "Labcorp at RWJBarnabas Health at George Street", location: "317 George Street, Suite 101, New Brunswick, NJ 08901", phone: "(866) 476-2522" }],
  warnings: [{ title: "Get urgent help · Call 911 for an emergency", urgent: true, items: ["Chest pain or pressure", "Fainting or severe dizziness"] }],
};

describe("discharge progress PDF", () => {
  it("contains the progress, plan, appointments and warnings, with typographic spaces cleaned", async () => {
    const logo = `data:image/png;base64,${readFileSync("public/brand/clearpath-mark.png").toString("base64")}`;
    const bytes = new Uint8Array((await buildProgressPdf(report, logo)).output("arraybuffer"));
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, bytes);
    const text = (await new PDFParse({ data: bytes }).getText()).text;
    for (const expected of ["Progress since discharge", "Days tracked: 1", "Tasks completed: 2 / 3 (67%)", "Day 1", "Sun, October 11", "each day you use ClearPath adds a new row", "Discharge Progress", "Walter Brennan", "Today's progress - 2 / 3 done", "Weigh yourself", "Not yet: Apixaban, Metformin", "Twice Daily for 3 Additional Days", "Lisinopril", "Scheduled: Wednesday, October 14 · 9:00 AM", "(866) 476-2522", "Chest pain or pressure"]) expect(text).toContain(expected);
  });
});
