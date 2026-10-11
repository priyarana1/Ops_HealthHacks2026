import type { GeneratedContent } from "@/lib/backend/contracts";
import type { Medication, PlanContent, WarningZone } from "@/types/plan";

/**
 * Converts the backend's reviewed discharge content into the frontend PlanContent shape
 * used by the provider preview and the patient app. It only regroups and cleans up
 * formatting: medicine names, doses and frequencies are passed through unchanged, and
 * nothing is invented (no dates, tablet counts or thresholds).
 */

type BackendMedication = GeneratedContent["medications"][number];

/** Drops list bullets and status labels copied from the source ("• NEW: …"). Words are unchanged. */
export function cleanProse(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/^\s*[•▪◦·*-]\s*/, "")
    .replace(/^(NEW|CONTINUE|CHANGED?|STOP(?:PED)?|HOLD|HELD)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const isHeading = (text: string) => /:$/.test(text);

function frequencyText(m: BackendMedication) {
  const duration = m.duration ? (/^for\b/i.test(m.duration) ? m.duration : `for ${m.duration}`) : "";
  return [m.frequency, duration].filter(Boolean).join(" ") || undefined;
}

function toMedication(m: BackendMedication): Medication {
  let note = cleanProse(m.plainLanguage) || undefined;
  if (m.status === "STOP" && !/\bstop/i.test(note ?? "")) note = `Stop taking this.${note ? " " + note : ""}`;
  if (m.status === "HOLD" && !/\bhold|\bheld|for now/i.test(note ?? "")) note = `Do not take this for now.${note ? " " + note : ""}`;
  return {
    name: m.formulation && !m.name.toLowerCase().includes(m.formulation.toLowerCase()) ? `${m.name} (${m.formulation})` : m.name,
    dose: m.dose ?? undefined,
    route: m.route ?? undefined,
    frequency: frequencyText(m),
    note,
  };
}

export function toPlanContent(content: GeneratedContent): PlanContent {
  const items = (list: { text: string }[]) => list.map((i) => cleanProse(i.text)).filter((t) => t && !isHeading(t));
  const why = cleanProse(content.summary?.text) || items(content.hospitalCourse).join(" ");
  // The patient checklist gives the first weigh-in, sodium and fluid items special treatment by id.
  const special: Array<[string, RegExp]> = [["weigh", /\bweigh/i], ["salt", /\bsodium\b|\bsalt\b/i], ["fluids", /\bfluid/i]];
  const used = new Set<string>();
  const todos = (["dailyActions", "diet", "fluids", "activity", "otherInstructions"] as const).flatMap((section) =>
    items(content[section]).map((label, i) => {
      const match = special.find(([id, pattern]) => !used.has(id) && pattern.test(label))?.[0];
      if (match) used.add(match);
      return { id: match ?? `${section}-${i}`, label };
    }),
  );
  const appointments = [...items(content.appointments), ...items(content.labsAndMonitoring)].map((type) => ({ type, scheduleNeeded: true }));
  const zone = (severity: WarningZone["severity"], levels: string[]): WarningZone[] => {
    const zoneItems = content.warningSigns.filter((w) => levels.includes(w.level)).map((w) => cleanProse(w.text)).filter(Boolean);
    return zoneItems.length ? [{ severity, items: zoneItems }] : [];
  };
  return {
    whyTitle: "Why you were in the hospital",
    why,
    medications: {
      new: content.medications.filter((m) => m.status === "NEW" || m.status === "CHANGE").map(toMedication),
      keep: content.medications.filter((m) => m.status === "CONTINUE").map(toMedication),
      stop: content.medications.filter((m) => m.status === "STOP" || m.status === "HOLD").map(toMedication),
    },
    todos,
    appointments,
    warnings: [...zone("yellow", ["CONTACT_CARE_TEAM"]), ...zone("red", ["URGENT", "EMERGENCY"])],
  };
}

/** All patient-facing prose in a plan, for reading-level scoring. */
export function patientText(plan: PlanContent): string[] {
  const meds = [...plan.medications.new, ...plan.medications.keep, ...plan.medications.stop];
  return [plan.why, ...meds.map((m) => m.note ?? ""), ...plan.todos.map((t) => t.label), ...plan.warnings.flatMap((w) => w.items)].filter(Boolean);
}

function syllables(word: string) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

/** Flesch-Kincaid grade level of the given text, rounded to one decimal; null if empty. */
export function readingGrade(texts: string[]): number | null {
  const text = texts.join(". ");
  const words = text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  if (!words.length) return null;
  const sentences = Math.max(1, texts.reduce((n, t) => n + Math.max(1, (t.match(/[.!?]+(\s|$)/g) ?? []).length), 0));
  const syllableCount = words.reduce((n, w) => n + syllables(w), 0);
  const grade = 0.39 * (words.length / sentences) + 11.8 * (syllableCount / words.length) - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}

/** Examples of source wording that the simplifier rewrote: [source, patient wording]. */
export function plainLanguageSwaps(content: GeneratedContent, limit = 6): Array<[string, string]> {
  const norm = (s: string) => cleanProse(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const pairs: Array<[string, string]> = [];
  const consider = (quote: string, text: string) => {
    const before = cleanProse(quote), after = cleanProse(text);
    if (before && after && !isHeading(before) && norm(before) !== norm(after)) pairs.push([before, after]);
  };
  for (const section of ["dailyActions", "diet", "fluids", "activity", "otherInstructions", "labsAndMonitoring", "appointments"] as const)
    for (const item of content[section]) consider(item.evidence.quote, item.text);
  for (const w of content.warningSigns) consider(w.evidence.quote, w.text);
  for (const m of content.medications) consider(m.evidence.quote, m.plainLanguage);
  return pairs.slice(0, limit);
}

const MEDICATION_ISSUE = /^(unverified-medication|medication|formulation|duration|status|source-conflict)-/;
/** Unresolved review flags that concern medications. */
export function openMedicationFlags(content: GeneratedContent): number {
  return content.issues.filter((i) => MEDICATION_ISSUE.test(i.id) && !i.resolution?.trim()).length;
}
