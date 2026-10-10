import { DischargePlan } from './models';
import { AppError, assertActive } from '@/lib/security/core';
export async function ownedPlan(id: string, owner: string) { const plan = await DischargePlan.findOne({ planId: id, owner }); if (!plan)
    throw new AppError(404, 'Discharge plan not found.'); assertActive(plan.expiresAt); return plan; }
export function sourceText(plan: InstanceType<typeof DischargePlan>) { return `CHART CONTEXT (not finalized AVS):\n${JSON.stringify(plan.source.chart || {})}\nFINALIZED SYNTHETIC AVS / CLINICIAN DISCHARGE TEXT:\n${plan.clinicalInput || ''}\n${plan.transcriptConfirmed ? 'CLINICIAN-CONFIRMED SUPPLEMENTAL TRANSCRIPT:\n' + plan.transcript : ''}`; }
