import { redirect } from 'next/navigation';
import { identity } from '@/lib/auth/session';
import { DischargePlan } from '@/lib/db/models';
import { assertPlanAccess } from '@/lib/security/core';
import { planContent } from '@/lib/ai/schemas';
import PlanView from '@/components/plan-view';
import Logout from '@/components/logout';
export const dynamic = 'force-dynamic';
export default async function Dashboard() { let session; try {
    session = await identity('patient');
}
catch {
    redirect('/patient');
} const plan = await DischargePlan.findOne({ planId: session.planId, patientId: session.identity }); if (!plan)
    return <main className="patient"><h1>Your plan is unavailable</h1><p>It may have expired. Contact your care team for help.</p><Logout /></main>; try {
    assertPlanAccess(session, plan);
}
catch {
    return <main className="patient"><h1>Your plan is unavailable or expired</h1><p>Contact your care team for help.</p><Logout /></main>;
} return <main className="patient"><div className="row"><h1>Your recovery plan</h1><Logout /></div><p>Reviewed and approved by your clinician.</p><p className="muted">Available through {new Date(plan.expiresAt).toLocaleDateString()}.</p><PlanView plan={planContent.parse(plan.structured)}/></main>; }
