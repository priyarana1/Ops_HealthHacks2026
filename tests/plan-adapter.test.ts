import { describe, it, expect } from "vitest";
import type { GeneratedContent } from "../src/lib/backend/contracts";
import { cleanProse, medicationSchedule, toPlanContent, readingGrade, plainLanguageSwaps, openMedicationFlags, patientText, splitItems, shortDiagnosis } from "../src/lib/plan-adapter";
import { planContentSchema } from "../src/types/plan";

const ev = (quote: string) => ({ sourceId: "12345678-1234-4234-8234-123456789012", quote });
const med = (status: GeneratedContent["medications"][number]["status"], name: string, extra: Partial<GeneratedContent["medications"][number]> = {}) =>
  ({ name, dose: null, route: null, frequency: null, duration: null, formulation: null, status, notes: "", plainLanguage: `• ${status}: ${name} text.`, evidence: ev(name), ...extra });
const content: GeneratedContent = {
  language: "en", summary: { text: "Your heart was not pumping well.", evidence: ev("ADHF") }, hospitalCourse: [], diagnoses: [],
  medications: [
    med("NEW", "Furosemide", { dose: "40 mg", route: "by mouth", frequency: "once daily", plainLanguage: "• NEW: Furosemide 40 mg by mouth once daily to remove extra fluid.", evidence: ev("Furosemide 40 mg by mouth once daily for volume management.") }),
    med("NEW", "Amoxicillin-clavulanate", { dose: "875/125 mg", frequency: "twice daily", duration: "3 additional days" }),
    med("CHANGE", "Metoprolol", { formulation: "succinate", dose: "50 mg", frequency: "once daily" }),
    med("CONTINUE", "Apixaban", { dose: "5 mg", frequency: "twice daily" }),
    med("STOP", "Lisinopril", { plainLanguage: "Replaced with losartan." }),
    med("HOLD", "Spironolactone", { plainLanguage: "On hold pending repeat potassium tests." }),
  ],
  dailyActions: [{ text: "• Weigh yourself each morning.", evidence: ev("Monitor daily weight at approximately the same time each morning.") }, { text: "Health problems at discharge:", evidence: ev("Discharge diagnoses:") }],
  diet: [{ text: "Aim for about 2 grams of sodium daily.", evidence: ev("approximately 2 grams of sodium daily") }],
  fluids: [], activity: [], otherInstructions: [],
  appointments: [{ text: "See primary care within about 1 week.", evidence: ev("Follow up with primary care within approximately 1 week.") }],
  labsAndMonitoring: [{ text: "Get a blood test for kidney function.", evidence: ev("Obtain a basic metabolic panel.") }],
  warningSigns: [
    { text: "Call if your legs swell more.", level: "CONTACT_CARE_TEAM", evidence: ev("worsening swelling") },
    { text: "Chest pain or pressure.", level: "URGENT", evidence: ev("Chest pain or pressure.") },
    { text: "Fainting.", level: "EMERGENCY", evidence: ev("Syncope.") },
  ],
  definitions: [], teachBackQuestions: [], practicalBarriers: [],
  issues: [
    { id: "medication-3", severity: "warning", description: "route missing", resolution: null },
    { id: "status-1", severity: "critical", description: "status", resolution: "Checked." },
    { id: "source-completeness", severity: "critical", description: "compare", resolution: null },
  ],
};

describe("plan adapter", () => {
  const plan = toPlanContent(content);
  it("produces a valid frontend PlanContent", () => expect(() => planContentSchema.parse(plan)).not.toThrow());
  it("groups medicines into new, keep and stop/hold without changing values", () => {
    expect(plan.medications.new.map((m) => m.name)).toEqual(["Furosemide", "Amoxicillin-clavulanate", "Metoprolol (succinate)"]);
    expect(plan.medications.keep.map((m) => m.name)).toEqual(["Apixaban"]);
    expect(plan.medications.stop.map((m) => m.name)).toEqual(["Lisinopril", "Spironolactone"]);
    expect(plan.medications.new[0]).toMatchObject({ dose: "40 mg", route: "by mouth", frequency: "once daily", note: "Furosemide 40 mg by mouth once daily to remove extra fluid." });
    expect(plan.medications.new[1]).toMatchObject({ frequency: "twice daily", duration: "for 3 additional days" });
    expect(medicationSchedule(plan.medications.new[1])).toBe("twice daily for 3 additional days");
  });
  it("keeps STOP and HOLD distinct in the patient note", () => {
    expect(plan.medications.stop[0].note).toMatch(/^Stop taking this\./);
    expect(plan.medications.stop[1].note).toBe("On hold pending repeat potassium tests.");
  });
  it("builds to-dos without headings, and appointments without invented dates", () => {
    expect(plan.todos).toEqual([{ id: "weigh", label: "Weigh yourself each morning." }, { id: "salt", label: "Aim for about 2 grams of sodium daily." }]);
    expect(plan.appointments).toEqual([{ type: "See primary care within about 1 week.", scheduleNeeded: true }, { type: "Get a blood test for kidney function.", scheduleNeeded: true }]);
  });
  it("maps call-the-team signs to yellow and urgent or emergency signs to red", () => {
    expect(plan.warnings).toEqual([{ severity: "yellow", items: ["Call if your legs swell more."] }, { severity: "red", items: ["Chest pain or pressure.", "Fainting."] }]);
  });
  it("cleans copied bullets and status labels only", () => expect(cleanProse("•  CONTINUE: Apixaban 5 mg.")).toBe("Apixaban 5 mg."));
  it("scores reading level, lower for simpler text", () => {
    const simple = readingGrade(["Take your pill. Weigh each day."])!, complex = readingGrade(["Administer anticoagulation therapeutically, monitoring hemodynamic parameters continuously."])!;
    expect(simple).toBeLessThan(complex);
    expect(readingGrade(patientText(plan))).not.toBeNull();
    expect(readingGrade([])).toBeNull();
  });
  it("lists real before/after rewrites and counts open medication flags", () => {
    expect(plainLanguageSwaps(content)[0]).toEqual(["Monitor daily weight at approximately the same time each morning.", "Weigh yourself each morning."]);
    expect(openMedicationFlags(content)).toBe(1);
  });
});

describe("plan adapter with a translation", () => {
  const es: GeneratedContent = { ...content, medications: content.medications.map((m) => ({ ...m, plainLanguage: m.status === "STOP" ? "Reemplazado por losartan." : m.plainLanguage })) };
  const plan = toPlanContent(es, "es", content);
  it("uses labels in the patient's language and decides stop/hold from the English", () => {
    expect(plan.whyTitle).toBe("Por qué estuvo en el hospital");
    expect(plan.medications.stop[0].note).toBe("Deje de tomar este medicamento. Reemplazado por losartan.");
  });
  it("keeps medicine names and doses from the approved plan", () => expect(plan.medications.new[0]).toMatchObject({ name: "Furosemide", dose: "40 mg" }));
  it("drops a translated status label only where the English had one", () => {
    const labelled: GeneratedContent = { ...content, medications: content.medications.map((m, i) => (i === 0 ? { ...m, plainLanguage: "• NUEVO: Tome Furosemide 40 mg." } : m)) };
    expect(toPlanContent(labelled, "es", content).medications.new[0].note).toBe("Tome Furosemide 40 mg.");
    const plainEnglish: GeneratedContent = { ...content, medications: content.medications.map((m, i) => (i === 0 ? { ...m, plainLanguage: "A water pill." } : m)) };
    expect(toPlanContent({ ...plainEnglish, medications: plainEnglish.medications.map((m, i) => (i === 0 ? { ...m, plainLanguage: "Nota: una pastilla." } : m)) }, "es", plainEnglish).medications.new[0].note).toBe("Nota: una pastilla.");
  });
});

describe("keeping patient items short", () => {
  it("splits a bulleted instruction into separate items and drops its lead-in heading", () => {
    expect(splitItems("Nurses usually go over:\n• Finish the antibiotic.\n• Care for your IV line.")).toEqual(["Finish the antibiotic.", "Care for your IV line."]);
    expect(splitItems("• Weigh daily. • Keep a log.")).toEqual(["Weigh daily.", "Keep a log."]);
  });
  it("makes a warning zone item per bullet", () => {
    const warned = toPlanContent({ ...content, warningSigns: [{ text: "Get urgent care for:\n• New chest pain.\n• Fainting.", level: "URGENT", evidence: ev("x") }] });
    expect(warned.warnings).toEqual([{ severity: "red", items: ["New chest pain.", "Fainting."] }]);
  });
  it("summarises diagnoses as up to three condition names", () => {
    expect(shortDiagnosis(["• Infective endocarditis: an infection of the mitral valve. • Long-term heart failure that recently got worse, with reduced EF. • Pulmonary edema: fluid in the lungs. • Anemia."])).toBe("Infective endocarditis, Long-term heart failure that recently got worse, Pulmonary edema");
    expect(shortDiagnosis(["Problems when you came to the hospital: Your heart failure got worse."])).toBe("Your heart failure got worse");
  });
});

describe("pill counts", () => {
  it("are passed through only when supplied, never derived from the dose", () => {
    expect(toPlanContent(content).medications.new[0].tabletCount).toBeUndefined();
    const supplied: GeneratedContent = { ...content, medications: content.medications.map((m, i) => (i === 0 ? { ...m, tabletCount: 2 } : m)) };
    expect(toPlanContent(supplied).medications.new[0]).toMatchObject({ dose: "40 mg", tabletCount: 2 });
  });
});
