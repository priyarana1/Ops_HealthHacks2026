import type { GeneratedContent } from "@/lib/backend/contracts";
import type { Language, Medication, PlanContent, WarningZone } from "@/types/plan";

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

/** Splits one stored instruction into separate items: one per line or bullet, without lead-in headings. */
export function splitItems(text: string): string[] {
  return text.split(/\n+|\s+[•▪◦·]\s+/).map(cleanProse).filter((t) => t && !isHeading(t));
}

/** A short diagnosis for the profile and dashboard: up to three condition names, without explanations. */
export function shortDiagnosis(texts: string[]): string {
  const names = texts
    .flatMap(splitItems)
    .map((t) => t.replace(/^(problems|diagnos\w*|health problems|reason)[^:]{0,50}:\s*/i, ""))
    .map((t) => t.split(/[:.;,(]/)[0].trim())
    .filter(Boolean);
  return [...new Set(names)].slice(0, 3).join(", ");
}

function frequencyText(m: BackendMedication, lang: Language) {
  // Translated durations carry their own wording ("durante 3 días más"); only English gets "for".
  const duration = m.duration ? (lang !== "en" || /^for\b/i.test(m.duration) ? m.duration : `for ${m.duration}`) : "";
  return [m.frequency, duration].filter(Boolean).join(" ") || undefined;
}

// Fixed labels shown in the patient's language. The section title matches the sample translations.
const LABELS: Record<Language, { why: string; stop: string; hold: string }> = {
  en: { why: "Why you were in the hospital", stop: "Stop taking this.", hold: "Do not take this for now." },
  es: { why: "Por qué estuvo en el hospital", stop: "Deje de tomar este medicamento.", hold: "No tome este medicamento por ahora." },
  zh: { why: "您为什么住院", stop: "停止服用此药。", hold: "暂时不要服用此药。" },
  ar: { why: "لماذا كنت في المستشفى", stop: "توقف عن تناول هذا الدواء.", hold: "لا تتناول هذا الدواء في الوقت الحالي." },
};

function toMedication(m: BackendMedication, lang: Language, english: BackendMedication): Medication {
  let note = cleanProse(m.plainLanguage) || undefined;
  // A translated status label ("NUEVO:") is dropped only where the English had one ("NEW:").
  if (lang !== "en" && note && /^\s*[•▪◦·*-]?\s*(NEW|CONTINUE|CHANGED?|STOP(?:PED)?|HOLD|HELD)\s*:/i.test(english.plainLanguage)) note = note.replace(/^[^:：]{1,15}[:：]\s*/, "") || note;
  // Whether the explanation already says stop/hold is decided on the approved English wording.
  const said = cleanProse(english.plainLanguage);
  if (m.status === "STOP" && !/\bstop/i.test(said)) note = `${LABELS[lang].stop}${note ? " " + note : ""}`;
  if (m.status === "HOLD" && !/\bhold|\bheld|for now/i.test(said)) note = `${LABELS[lang].hold}${note ? " " + note : ""}`;
  return {
    name: m.formulation && !m.name.toLowerCase().includes(m.formulation.toLowerCase()) ? `${m.name} (${m.formulation})` : m.name,
    dose: m.dose ?? undefined,
    route: m.route ?? undefined,
    frequency: frequencyText(m, lang),
    note,
  };
}

/**
 * `content` may be a translation of `english` (same structure, translated prose); fixed labels
 * follow `lang`. For English, both are the same content.
 */
export function toPlanContent(content: GeneratedContent, lang: Language = "en", english: GeneratedContent = content): PlanContent {
  const med = (status: (m: BackendMedication) => boolean) =>
    content.medications.map((m, i) => [m, english.medications[i] ?? m] as const).filter(([m]) => status(m)).map(([m, e]) => toMedication(m, lang, e));
  const items = (list: { text: string }[]) => list.flatMap((i) => splitItems(i.text));
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
    const zoneItems = content.warningSigns.filter((w) => levels.includes(w.level)).flatMap((w) => splitItems(w.text));
    return zoneItems.length ? [{ severity, items: zoneItems }] : [];
  };
  return {
    whyTitle: LABELS[lang].why,
    why,
    medications: {
      new: med((m) => m.status === "NEW" || m.status === "CHANGE"),
      keep: med((m) => m.status === "CONTINUE"),
      stop: med((m) => m.status === "STOP" || m.status === "HOLD"),
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
