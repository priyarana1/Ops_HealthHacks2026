/**
 * SYNTHETIC DEMO DATA for the coordinator view (ported from CoordinatorApp.html).
 *
 * IMPORTANT: the audit log intentionally contains NO PHI — only discharge_id, event,
 * timestamps and a generic list of deleted item types. Patient names appear only in the
 * escalation list, which is the care-staff follow-up queue (also synthetic here).
 */

export type Zone = "red" | "yellow" | "gray" | "";
export type EscalationKind = "weight" | "chest" | "swell" | "nocheck" | "mh" | "appt";

export interface Escalation {
  id: number;
  name: string;
  dx: string;
  zone: Zone;
  trigger: string;
  flag: string;
  last: string;
  kind: EscalationKind;
}

export const ESCALATIONS: Escalation[] = [
  { id: 1, name: "Eleanor Okafor", dx: "Heart failure (reduced EF)", zone: "yellow", trigger: "Weight up 4 lb", flag: "", last: "Today 7:58 AM", kind: "weight" },
  { id: 2, name: "Walter Brennan", dx: "Heart failure (reduced EF)", zone: "red", trigger: "Reported chest pain", flag: "", last: "Today 8:10 AM", kind: "chest" },
  { id: 3, name: "Rosa Delgado", dx: "Heart failure (preserved EF), AFib", zone: "yellow", trigger: "More swelling", flag: "", last: "Yesterday", kind: "swell" },
  { id: 4, name: "Mei Chen", dx: "Heart failure with kidney injury", zone: "gray", trigger: "No check-in", flag: "No check-in for 2 days", last: "2 days ago", kind: "nocheck" },
  { id: 5, name: "Harold Pike", dx: "COPD with heart failure", zone: "", trigger: "", flag: "Mental-health flag: said \u201CI feel alone\u201D (988 shown)", last: "Today 9:05 AM", kind: "mh" },
  { id: 6, name: "Grace Lin", dx: "Heart failure (reduced EF)", zone: "", trigger: "", flag: "No cardiology appointment date set", last: "\u2014", kind: "appt" },
];

/** 7-day weight trend for Eleanor's drawer chart (lb). */
export const ELEANOR_WEIGHTS = [181, 181, 182, 182, 181, 182, 186];

export interface AuditRow {
  id: string;
  event: "published" | "purged";
  created: number;
  exp: number;
  del: number | null;
  items: string;
  state: "live" | "expiring" | "purged";
}

const D = 864e5;
const H = 36e5;

/** Fresh audit snapshot (dates relative to now so the demo never looks stale). */
export function makeAudit(now = Date.now()): AuditRow[] {
  return [
    { id: "DSC-7Q2K", event: "published", created: now - (2 * D + 20 * H), exp: now - (2 * D + 20 * H) + 30 * D, del: null, items: "\u2014", state: "live" },
    { id: "DSC-3A8M", event: "published", created: now - (13 * D + 16 * H), exp: now - (13 * D + 16 * H) + 30 * D, del: null, items: "\u2014", state: "live" },
    { id: "DSC-9F1C", event: "purged", created: now - 62 * D, exp: now - 32 * D, del: now - 32 * D, items: "audio, transcript, translations, chat logs", state: "purged" },
  ];
}
