import { describe, it, expect } from "vitest";
import { withScheduledAppointments } from "../src/lib/demo-appointments";
import type { PlanContent } from "../src/types/plan";

const plan = (types: string[]): PlanContent => ({ whyTitle: "", why: "", medications: { new: [], keep: [], stop: [] }, todos: [], warnings: [], appointments: types.map((type) => ({ type, scheduleNeeded: true })) });

describe("demo appointment scheduling", () => {
  // Example 1: discharged Friday 2026-10-09 10:00 local; the plan expires 30 days later.
  const expiresAt = new Date(new Date(2026, 9, 9, 10).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const english = plan(["See your primary care doctor and heart doctor within about 1 week.", "Get a blood test for your kidneys and potassium before or at your first follow-up visit."]);
  it("books the follow-up at Old Bridge and the blood test at Labcorp George Street, on weekdays", () => {
    const [visit, labs] = withScheduledAppointments(english, english, expiresAt, "en").appointments;
    expect(visit).toMatchObject({ type: "Primary care doctor and heart doctor appointment", scheduleNeeded: false, clinic: "RWJBarnabas Health Primary & Specialty Care at Old Bridge", phone: "(848) 289-4400", when: "Friday, October 16 · 10:30 AM" });
    expect(labs).toMatchObject({ type: "Blood test appointment", scheduleNeeded: false, clinic: "Labcorp at RWJBarnabas Health at George Street", location: "317 George Street, Suite 101, New Brunswick, NJ 08901", when: "Wednesday, October 14 · 9:00 AM" });
    expect(labs.mapsUrl).toContain("317%20George%20Street");
  });
  it("uses titles in the patient's language and matches on the English", () => {
    const es = withScheduledAppointments(plan(["Vea a su médico de cabecera", "Hágase un análisis de sangre"]), english, expiresAt, "es").appointments;
    expect(es.map((a) => [a.type, a.phone])).toEqual([["Cita con su médico de cabecera y su cardiólogo", "(848) 289-4400"], ["Cita para análisis de sangre", "(866) 476-2522"]]);
  });
});
