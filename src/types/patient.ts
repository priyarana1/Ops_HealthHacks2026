import { z } from "zod";
import { planStatusSchema, languageSchema } from "./plan";

/** Synthetic patient demographics. No real PHI — demo data only. */
export const patientSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().int().positive(),
  mrn: z.string(),
  primaryDiagnosis: z.string(),
  summary: z.string(),
});
export type Patient = z.infer<typeof patientSchema>;

/** One row in the provider dashboard discharge list. */
export const dischargeListItemSchema = z.object({
  planId: z.string(),
  patientName: z.string(),
  mrn: z.string(),
  diagnosis: z.string(),
  languages: z.array(languageSchema),
  status: planStatusSchema,
  lastUpdated: z.string(),
  /** Only wired-up records are openable in the demo. */
  openable: z.boolean().default(false),
});
export type DischargeListItem = z.infer<typeof dischargeListItemSchema>;
