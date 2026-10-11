import { z } from "zod";

/**
 * ClearPath domain schemas (zod -> TS types).
 *
 * These model the *approved discharge plan* that both portals share. The structure
 * follows the Blueprint prototypes and docs/ProjectPlan.md:
 *  - medications grouped as NEW / KEEP / STOP-HOLD
 *  - two-tier warning zones (yellow = call team, red = 911)
 *  - per-language translated content with drug names/numbers held identical
 *
 * Hard rules encoded here (see CLAUDE.md non-negotiables):
 *  - expiresAt is derived server-side from createdAt + 30 days; never client-set.
 *  - Nothing is patient-readable until status === "approved".
 */

export const LANGS = ["en", "es", "zh", "ar"] as const;
export const languageSchema = z.enum(LANGS);
export type Language = z.infer<typeof languageSchema>;

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  es: "Español",
  zh: "中文",
  ar: "العربية",
};

export const LANGUAGE_DIR: Record<Language, "ltr" | "rtl"> = {
  en: "ltr",
  es: "ltr",
  zh: "ltr",
  ar: "rtl",
};

/** Medication group. STOP/HOLD items may omit dose/timing (they are being discontinued). */
export const medGroupSchema = z.enum(["new", "keep", "stop"]);
export type MedGroup = z.infer<typeof medGroupSchema>;

export const medicationSchema = z.object({
  name: z.string(),
  dose: z.string().optional(),
  /** Tablets per dose, explicitly supplied by pharmacy or demo data; never inferred from mg. */
  tabletCount: z.number().positive().optional(),
  frequency: z.string().optional(),
  purpose: z.string().optional(),
  /** Patient-readable route, only when present in the source prescription. */
  route: z.string().optional(),
  note: z.string().optional(),
  /** Safety callout rendered inline, e.g. "Do not take both. Losartan replaces lisinopril." */
  warning: z.string().optional(),
});
export type Medication = z.infer<typeof medicationSchema>;

export const warningZoneSchema = z.object({
  severity: z.enum(["yellow", "red"]),
  /** yellow => call care team; red => ER / 911 */
  items: z.array(z.string()).min(1),
});
export type WarningZone = z.infer<typeof warningZoneSchema>;

export const appointmentSchema = z.object({
  type: z.string(),
  specialty: z.string().optional(),
  when: z.string().optional(),
  /** Clinic or lab name, shown above the address. */
  clinic: z.string().optional(),
  location: z.string().optional(),
  /** Map link for the address. */
  mapsUrl: z.string().url().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  prep: z.string().optional(),
  /** true => "Scheduling needed" (no date invented). */
  scheduleNeeded: z.boolean().default(false),
});
export type Appointment = z.infer<typeof appointmentSchema>;

export const todoSchema = z.object({
  id: z.string(),
  label: z.string(),
});
export type TodoItem = z.infer<typeof todoSchema>;

/** The patient-facing content for one language. Drug names/numbers must match across langs. */
export const planContentSchema = z.object({
  whyTitle: z.string(),
  why: z.string(),
  medications: z.object({
    new: z.array(medicationSchema),
    keep: z.array(medicationSchema),
    stop: z.array(medicationSchema),
  }),
  todos: z.array(todoSchema),
  appointments: z.array(appointmentSchema),
  warnings: z.array(warningZoneSchema),
});
export type PlanContent = z.infer<typeof planContentSchema>;

export const planStatusSchema = z.enum([
  "draft",
  "needs_review",
  "approved",
  "needs_reapproval",
  "expired",
]);
export type PlanStatus = z.infer<typeof planStatusSchema>;

export const langStatusSchema = z.enum([
  "none",
  "translated",
  "verified",
  "blocked",
  "published",
]);
export type LangStatus = z.infer<typeof langStatusSchema>;

export const dischargePlanSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  status: planStatusSchema,
  primaryDiagnosis: z.string(),
  /** ISO strings. expiresAt is createdAt + 30 days, assigned server-side. */
  createdAt: z.string(),
  expiresAt: z.string(),
  /** English is required; other languages are opt-in per discharge. */
  languages: z.array(languageSchema),
  langStatus: z.record(languageSchema, langStatusSchema),
  /** Approved patient-facing content keyed by language. */
  content: z.record(languageSchema, planContentSchema),
});
export type DischargePlan = z.infer<typeof dischargePlanSchema>;
