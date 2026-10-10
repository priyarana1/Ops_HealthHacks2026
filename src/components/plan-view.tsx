import type { PlanContent } from '@/lib/ai/schemas';
export default function PlanView({ plan }: {
    plan: PlanContent;
}) {
    const list = (items: {
        text: string;
    }[]) => items.length ? <ul>{items.map((item, i) => <li key={i}>{item.text}</li>)}</ul> : <p className="muted">No instructions were supplied in this section.</p>;
    return <><section className="card"><h2>Why You Were in the Hospital</h2><p>{plan.reasonForHospitalization?.text || 'No reason was supplied.'}</p>{list(plan.diagnoses)}</section><section className="card"><h2>Your Medicines</h2>{!plan.medications.length && <p>No medication instructions were supplied.</p>}{plan.medications.map((m, i) => <article className="card" key={i}><span className={'badge ' + m.status}>{m.status}</span><h3>{m.name}</h3><p>{m.patientFriendlyExplanation}</p><p>Dose: {m.dose || 'Not supplied'}<br />How to take it: {m.route || 'Not supplied'}<br />How often: {m.frequency || 'Not supplied'}<br />How long: {m.duration || 'Not supplied'}</p></article>)}</section><section className="card"><h2>What You Need to Do at Home</h2>{list(plan.dailyInstructions)}</section><section className="card"><h2>Your Follow-Up Appointments</h2>{list(plan.appointments)}</section><section className="card"><h2>When to Call Your Care Team</h2>{list(plan.warningSigns)}</section><section className="card"><h2>When to Get Emergency Help</h2>{list(plan.emergencyInstructions)}</section></>;
}
