import { z } from 'zod';
import { AppError } from '../security/core';
const reference = z.object({ id: z.string().min(1), quote: z.string().min(1) }).strict();
const instruction = z.object({ text: z.string().min(1), sourceReference: z.string().min(1) }).strict();
export const planContent = z.object({ reasonForHospitalization: instruction.nullable(), diagnoses: z.array(instruction), medications: z.array(z.object({ name: z.string().min(1), dose: z.string().nullable(), route: z.string().nullable(), frequency: z.string().nullable(), duration: z.string().nullable(), status: z.enum(['NEW', 'CONTINUE', 'STOP', 'HOLD', 'CHANGED']), patientFriendlyExplanation: z.string(), sourceReference: z.string() }).strict()), dailyInstructions: z.array(instruction), appointments: z.array(instruction), warningSigns: z.array(instruction), emergencyInstructions: z.array(instruction), ambiguityFlags: z.array(z.object({ id: z.string(), severity: z.enum(['high', 'low']), description: z.string(), resolution: z.string().nullable() }).strict()), sourceReferences: z.array(reference) }).strict();
export type PlanContent = z.infer<typeof planContent>;
export function validateEvidence(plan: PlanContent, source: string) {
    const refs = new Map(plan.sourceReferences.map(r => [r.id, r.quote]));
    if (refs.size !== plan.sourceReferences.length)
        throw new AppError(422, 'Source reference IDs must be unique.');
    for (const r of plan.sourceReferences)
        if (!source.includes(r.quote))
            throw new AppError(422, 'Source quotation was not found in the clinical input.');
    const items = [...(plan.reasonForHospitalization ? [plan.reasonForHospitalization] : []), ...plan.diagnoses, ...plan.dailyInstructions, ...plan.appointments, ...plan.warningSigns, ...plan.emergencyInstructions, ...plan.medications];
    for (const item of items)
        if (!refs.has(item.sourceReference))
            throw new AppError(422, 'Every instruction requires a valid source reference.');
    for (const m of plan.medications)
        for (const value of [m.name, m.dose, m.route, m.frequency, m.duration])
            if (value && !refs.get(m.sourceReference)!.toLowerCase().includes(value.toLowerCase()))
                throw new AppError(422, 'Medication values must appear verbatim in their cited source.');
}
export function flagMissingMedicationDetails(plan: PlanContent) {
    for (const [index, m] of plan.medications.entries()) {
        if (!['STOP', 'HOLD'].includes(m.status) && (!m.dose || !m.route || !m.frequency)) {
            const id = 'missing-medication-' + index;
            if (!plan.ambiguityFlags.some(f => f.id === id))
                plan.ambiguityFlags.push({ id, severity: 'high', description: `${m.name}: dose, route, or frequency is missing. Do not guess. Clinician must reconcile with the authoritative source.`, resolution: null });
        }
    }
    return plan;
}
// Sodium and salt are different quantities (2 g sodium is about 5 g salt); a swap changes the instruction.
export function flagSodiumAsSalt(plan: PlanContent, source: string) {
    if (!/\bsodium\b/i.test(source) || /\bsalt\b/i.test(source))
        return plan;
    const texts = [plan.reasonForHospitalization?.text, ...[...plan.diagnoses, ...plan.dailyInstructions, ...plan.appointments, ...plan.warningSigns, ...plan.emergencyInstructions].map(i => i.text), ...plan.medications.map(m => m.patientFriendlyExplanation)];
    if (texts.some(t => t && /\bsalt\b/i.test(t)) && !plan.ambiguityFlags.some(f => f.id === 'sodium-written-as-salt'))
        plan.ambiguityFlags.push({ id: 'sodium-written-as-salt', severity: 'high', description: 'The source says sodium, but the patient text says salt. These are different amounts. Reword to match the source.', resolution: null });
    return plan;
}
export function approvalGate(plan: PlanContent) { if (plan.ambiguityFlags.some(f => f.severity === 'high' && !f.resolution?.trim()))
    throw new AppError(422, 'Resolve all high-risk ambiguities before approval.'); }
