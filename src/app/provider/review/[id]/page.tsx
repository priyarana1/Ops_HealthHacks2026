'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/components/client-api';
import Recorder from '@/components/recorder';
import PlanView from '@/components/plan-view';
import StructuredEditor from '@/components/structured-editor';
import type { PlanContent } from '@/lib/ai/schemas';
interface Draft {
    planId: string;
    revision: number;
    patientId: string;
    status: string;
    clinicalInput?: string;
    transcript?: string;
    transcriptConfirmed: boolean;
    expiresAt: string;
    source: {
        demo?: boolean;
        chart?: unknown;
        processing?: string;
    };
    structured?: PlanContent;
}
export default function Review() {
    const { id } = useParams<{
        id: string;
    }>();
    const [plan, setPlan] = useState<Draft>(), [structured, setStructured] = useState<PlanContent>(), [avs, setAvs] = useState(''), [transcript, setTranscript] = useState(''), [confirmed, setConfirmed] = useState(false), [reviewed, setReviewed] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [invite, setInvite] = useState<{
        activationUrl: string;
        developmentOnlyOtp: string;
        otpExpiresAt: string;
    }>();
    const load = useCallback(async () => { const p = await api('discharges/' + id); setPlan(p); setStructured(p.structured || undefined); setAvs(p.clinicalInput || ''); setTranscript(p.transcript || ''); setConfirmed(p.transcriptConfirmed); setReviewed(false); }, [id]);
    useEffect(() => { load().catch(e => setError(e.message)); }, [load]);
    async function run(fn: () => Promise<void>) { setBusy(true); setError(''); setNotice(''); try {
        await fn();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    if (!plan)
        return <main><h1>Discharge review</h1><p role="status">{error || 'Loading draft…'}</p></main>;
    const editable = ['draft', 'review'].includes(plan.status);
    const dirty = avs !== (plan.clinicalInput || '') || transcript !== (plan.transcript || '') || confirmed !== plan.transcriptConfirmed || JSON.stringify(structured) !== JSON.stringify(plan.structured || undefined);
    return <main><h1>Review discharge plan</h1><div className="row"><span className="badge">{plan.status}</span><span>Expires {new Date(plan.expiresAt).toLocaleString()}</span></div>{plan.source.processing === 'synthetic-demo' && <p className="notice">Synthetic demonstration output. No Bedrock request was made.</p>}{error && <p className="error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}<div className="grid"><div><section className="card"><h2>Clinical source</h2><p className="notice">Chart information is context. Finalized AVS text is the authoritative discharge source. Resolve conflicts explicitly.</p><details><summary>Imported chart context</summary><pre>{JSON.stringify(plan.source.chart || 'No Epic chart imported.', null, 2)}</pre></details><label htmlFor="avs">Finalized synthetic AVS / clinician discharge text</label><textarea id="avs" value={avs} disabled={!editable} onChange={e => setAvs(e.target.value)} rows={12}/><label htmlFor="transcript">Supplemental transcript (editable)</label><textarea id="transcript" value={transcript} disabled={!editable} onChange={e => { setTranscript(e.target.value); setConfirmed(false); }}/><label><input type="checkbox" checked={confirmed} disabled={!editable} onChange={e => setConfirmed(e.target.checked)}/> I have reviewed and corrected the supplemental transcript.</label>{editable && <><button disabled={busy} onClick={() => run(async () => { await api('discharges/' + id, 'PATCH', { revision: plan.revision, clinicalInput: avs, transcript, transcriptConfirmed: confirmed }); await load(); setNotice('Source saved. Previous AI content was cleared.'); })}>Save source and transcript</button><p>Save changes before generating a new plan.</p><div className="row"><button disabled={busy} onClick={() => run(async () => { await api(`discharges/${id}/process`, 'POST', { demo: false }); await load(); })}>{busy ? 'Working…' : 'Generate with Bedrock'}</button>{plan.source.demo && <button disabled={busy} onClick={() => run(async () => { await api(`discharges/${id}/process`, 'POST', { demo: true }); await load(); })}>Generate synthetic demo (no API call)</button>}</div></>}</section>{editable && <Recorder planId={id} onDemo={text => { setTranscript(text); setConfirmed(false); setReviewed(false); }} onTranscript={() => load().catch(e => setError(e.message))}/>}</div><section className="card"><h2>Patient-ready instructions</h2><p>Validate every clinical detail against the source. Passing schema checks does not mean clinical verification.</p>{structured ? editable ? <><StructuredEditor value={structured} onChange={p => { setStructured(p); setReviewed(false); }}/><button disabled={busy} onClick={() => run(async () => { await api('discharges/' + id, 'PATCH', { revision: plan.revision, structured }); await load(); setNotice('Edited content saved. Review before approval.'); })}>Save reviewed content</button><label><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}/> I reviewed all instructions, medications, source references, and ambiguity resolutions.</label><button disabled={busy || !reviewed || dirty} onClick={() => run(async () => { await api(`discharges/${id}/approve`, 'POST', { revision: plan.revision, clinicalReviewConfirmed: true }); await load(); setNotice('Approved. Publish to create a patient invitation.'); })}>Approve saved plan</button><p>Approval applies to the saved revision. Save all edits first.</p></> : <PlanView plan={structured}/> : <p>Save source text and generate a draft to begin review.</p>}{['approved', 'published'].includes(plan.status) && <button disabled={busy} onClick={() => run(async () => { const result = await api(`discharges/${id}/publish`, 'POST', {}); setInvite(result); await load(); })}>{plan.status === 'published' ? 'Create a fresh patient invitation' : 'Publish approved plan'}</button>}{invite && <section className="notice"><h3>Development-only activation details</h3><p>Share the invitation and code separately during synthetic testing.</p><a href={invite.activationUrl}>{invite.activationUrl}</a><p><strong>Test OTP: {invite.developmentOnlyOtp}</strong></p><p>Code expires {new Date(invite.otpExpiresAt).toLocaleTimeString()}.</p></section>}</section></div></main>;
}
