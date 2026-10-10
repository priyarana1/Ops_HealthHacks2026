import type { Patient } from "@/types/patient";

/**
 * SYNTHETIC DEMO DATA ONLY. No real patient information.
 *
 * Eleanor Okafor — the primary heart-failure demo case. Ported from the Blueprint
 * prototypes. The raw clinician text below is the "source" shown on the left of the
 * clinician review screen; the simplified/translated plan lives in ./plan.ts.
 */

export const ELEANOR: Patient = {
  id: "pt-eleanor-okafor",
  name: "Eleanor Okafor",
  age: 72,
  mrn: "00-421-889",
  primaryDiagnosis: "Heart failure (reduced EF)",
  summary:
    "Acute on chronic heart failure (reduced EF), pneumonia, kidney injury (improving).",
};

/** OTP for the patient-link demo (matches the mock SMS in PatientApp.html). */
export const DEMO_OTP = "418203";

/** The raw EMR / spoken discharge note, shown verbatim as the clinician source. */
export const ELEANOR_SOURCE_TEXT = `72-year-old male. Admission dx: acute hypoxic respiratory failure due to acute on chronic systolic HF (EF 30%) and CAP.
D/C dx: ADHF HFrEF; RLL pneumonia; AKI, improved; HTN; T2DM; chronic AF; chronic anemia.

NEW MEDS
- furosemide 40 mg PO daily for volume management
- losartan 25 mg PO daily for HF / BP control
- empagliflozin 10 mg PO daily for HF / DM
- amoxicillin-clavulanate 875/125 mg PO BID x 3 additional days to complete CAP treatment

CONTINUE
- metoprolol succinate 50 mg daily
- apixaban 5 mg BID
- atorvastatin 40 mg nightly
- metformin 500 mg BID, provided renal function remains stable

STOPPED / HELD
- lisinopril d/c'd, changed to losartan
- spironolactone held pending repeat renal function and K
- avoid NSAIDs (HF, recent AKI)

INSTRUCTIONS
2 g Na diet. Daily weights, same time each AM. Keep written log of weight and symptoms. Follow fluid recs per HF team. Complete abx course. Obtain BMP before or at early f/u. F/u PCP and cardiology within ~1 wk.

RETURN PRECAUTIONS
New or worsening dyspnea esp. at rest; chest pain/pressure; syncope or severe dizziness; rapidly worsening LE/abdominal edema; significant decrease in UOP; new confusion or severe weakness; fever or worsening cough despite abx. Contact HF team for rapid weight gain or worsening edema/dyspnea per individualized weight-management plan.`;

/** The dictated version (used by the "record voice" capture path). Contains an
 *  intentionally garbled term ("met operol") that the transcript step flags. */
export const ELEANOR_SPOKEN_TEXT = `Okay, discharge instructions for the seventy-two-year-old with heart failure and pneumonia. New medicines: furosemide forty milligrams once a day, losartan twenty-five milligrams once a day, empagliflozin ten milligrams once a day, and amoxicillin-clavulanate eight seventy-five slash one twenty-five twice a day for three more days. Continue met operol fifty milligrams once a day, apixaban five milligrams twice a day, atorvastatin forty milligrams at night, and metformin five hundred milligrams twice a day if kidney function stays stable. Stop lisinopril, it's replaced by losartan. Hold spironolactone until the repeat labs. Avoid NSAIDs. Two gram sodium diet, weigh every morning, keep a log, follow the fluid plan, finish the antibiotic, BMP at the first visit, primary care and cardiology in about one week.`;

/** Plain-language term swaps shown on the review screen (clinician reassurance). */
export const PLAIN_LANGUAGE_SWAPS: Array<[string, string]> = [
  ["dyspnea", "shortness of breath"],
  ["BID", "twice a day"],
  ["PO", "by mouth"],
  ["NSAIDs", "pain pills like ibuprofen"],
  ["BMP", "blood test"],
  ["syncope", "fainting"],
  ["UOP", "urine"],
  ["LE edema", "leg swelling"],
  ["abx", "antibiotic"],
];
