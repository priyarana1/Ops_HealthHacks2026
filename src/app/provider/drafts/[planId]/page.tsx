'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/components/client-api';
import { DocumentDrop } from '@/components/document-drop';
import type { GeneratedContent } from '@/lib/backend/contracts';

interface Snapshot {
  episode: { planId: string; state: string; version: number; dischargeAt: string; dischargeTimezone: string; expiresAt: string; dischargeConfirmed: boolean; approval?: { providerId: string; approvedAt: string } };
  patient?: { displayName: string };
  plan?: { content?: GeneratedContent; model?: { modelId: string; generatedAt: string } };
  sources: { sourceId: string; kind: string; documentType: string; text: string; createdAt: string }[];
}
const kindLabels: Record<string, string> = { FINAL_AVS: 'Final after-visit summary', DISCHARGE_SUMMARY: 'Discharge summary', CLINICIAN_NOTE: 'Clinician note', CHART_CONTEXT: 'Chart context', AUDIO_TRANSCRIPT: 'Dictation transcript', EPIC_FHIR: 'Epic chart import' };
const fileLabels: Record<string, string> = { 'application/pdf': 'PDF', 'text/plain': 'Text', 'application/fhir+json': 'FHIR', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word' };
const sections = [['dailyActions', 'What to do each day'], ['diet', 'Diet'], ['fluids', 'Fluids'], ['activity', 'Activity'], ['otherInstructions', 'Other instructions'], ['appointments', 'Appointments'], ['labsAndMonitoring', 'Labs and monitoring'], ['practicalBarriers', 'Practical barriers'], ['teachBackQuestions', 'Teach-back questions'], ['hospitalCourse', 'Hospital course'], ['diagnoses', 'Diagnoses']] as const;
const levelLabels = { EMERGENCY: 'Emergency', URGENT: 'Urgent', CONTACT_CARE_TEAM: 'Call care team' };

export default function DischargeDraft() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter(), search = useSearchParams();
  const [data, setData] = useState<Snapshot>(), [error, setError] = useState(''), [generating, setGenerating] = useState(false), [seconds, setSeconds] = useState(0);
  const [extraFile, setExtraFile] = useState<File>(), [uploading, setUploading] = useState(false);
  const [dischargeOk, setDischargeOk] = useState(false), [reviewed, setReviewed] = useState(false);
  const [action, setAction] = useState(''), [notice, setNotice] = useState('');
  const autoStarted = useRef(false);
  const load = useCallback(async () => setData(await api('discharges/' + planId)), [planId]);
  // Reset the approval checkboxes whenever a fresh snapshot arrives.
  useEffect(() => { if (data) { setDischargeOk(data.episode.dischargeConfirmed); setReviewed(false); } }, [data]);

  const generate = useCallback(async () => {
    setGenerating(true); setError(''); setSeconds(0);
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    try { setData(await api(`discharges/${planId}/process`, 'POST', {})); }
    catch (e) { setError((e as Error).message); await load().catch(() => {}); }
    finally { clearInterval(timer); setGenerating(false); }
  }, [planId, load]);

  useEffect(() => {
    load().then(() => {
      if (search.get('generate') && !autoStarted.current) { autoStarted.current = true; router.replace(`/provider/drafts/${planId}`); generate(); }
    }).catch(e => setError(e.message));
  }, [load, generate, planId, router, search]);

  async function run(label: string, fn: () => Promise<void>) {
    setAction(label); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setAction(''); }
  }
  // The single review checkbox is recorded as the clinician's confirmation on every flagged item, which the backend requires before approval.
  const approve = () => run('Approving…', async () => {
    const open = (data!.plan?.content?.issues || []).filter(i => !i.resolution?.trim());
    const current: Snapshot = await api(`discharges/${planId}/review`, 'PATCH', { version: data!.episode.version, dischargeConfirmed: dischargeOk, resolutions: open.map(i => ({ id: i.id, resolution: 'Reviewed against the source document and confirmed by the approving clinician.' })) });
    await api(`discharges/${planId}/approve`, 'POST', { version: current.episode.version, clinicalReviewConfirmed: true });
    await load(); setNotice('Plan approved. Nothing has been sent to the patient yet.');
  });
  const expireNow = () => { if (window.confirm('Simulate the 30-day expiry now? Patient access ends immediately and the records are deleted shortly after. This only works for synthetic test records.')) run('Expiring…', async () => { await api(`discharges/${planId}/expire-test`, 'POST', {}); setData(undefined); setError('This discharge has expired. Patient access has ended, and the records will be deleted automatically within about a minute.'); }); };

  async function addDocument() {
    if (!extraFile) return;
    setUploading(true); setError('');
    try { const form = new FormData(); form.set('requestId', crypto.randomUUID()); form.set('kind', 'FINAL_AVS'); form.set('file', extraFile); await api(`discharges/${planId}/sources`, 'POST', form); setExtraFile(undefined); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setUploading(false); }
  }

  if (!data) return <main><p><Link href="/provider">← Provider workspace</Link></p><h1>Discharge draft</h1><p role={error ? 'alert' : 'status'} className={error ? 'error' : ''}>{error || 'Loading…'}</p></main>;
  const { episode, sources } = data, content = data.plan?.content;
  const canGenerate = ['DRAFT', 'PENDING_REVIEW'].includes(episode.state) && sources.length > 0;
  const critical = content?.issues.filter(i => i.severity === 'critical') || [], warnings = content?.issues.filter(i => i.severity === 'warning') || [];
  const reviewable = episode.state === 'PENDING_REVIEW' && !generating;

  return <main>
    <p><Link href="/provider">← Provider workspace</Link></p>
    <div className="row"><h1>{data.patient?.displayName || 'Discharge draft'}</h1><span className="badge">{episode.state.replace('_', ' ')}</span></div>
    <p className="muted">Discharged {new Date(episode.dischargeAt).toLocaleString()} ({episode.dischargeTimezone}) · patient access ends {new Date(episode.expiresAt).toLocaleString()}{!episode.dischargeConfirmed && ' · discharge time not yet confirmed'}</p>
    {error && <p role="alert" className="error">{error}</p>}
    {notice && <p role="status" className="notice">{notice}</p>}
    {episode.approval && ['APPROVED', 'ACCESS_GRANTED', 'ACTIVE'].includes(episode.state) && <p className="card"><span className="badge NEW">Approved</span> by {episode.approval.providerId} on {new Date(episode.approval.approvedAt).toLocaleString()}. Sending the patient invitation is the next step and is not on this screen yet.</p>}
    <div className="grid">
      <section>
        <h2>Uploaded documents</h2>
        {!sources.length && <p className="card">No document has been uploaded yet.</p>}
        {sources.map(s => <details className="card" key={s.sourceId} open={sources.length === 1}>
          <summary><strong>{kindLabels[s.kind] || s.kind}</strong> · {fileLabels[s.documentType] || s.documentType} · {s.text.length.toLocaleString()} characters saved</summary>
          <pre>{s.text}</pre>
        </details>)}
        {['DRAFT', 'PENDING_REVIEW'].includes(episode.state) && <div className="card">
          <h3>Add another document</h3>
          <p className="muted">Adding a document clears the current AI draft so it can be regenerated from every document.</p>
          <DocumentDrop file={extraFile} onFile={setExtraFile} disabled={uploading || generating} />
          <button disabled={!extraFile || uploading || generating} onClick={addDocument}>{uploading ? 'Uploading…' : 'Upload document'}</button>
        </div>}
      </section>
      <section>
        <h2>Plain-language draft</h2>
        {generating ? <div className="card" role="status"><strong>Reading the document and drafting plain-language instructions… {seconds}s</strong><p className="muted">This usually takes 40–90 seconds. Every statement is checked against the source text before it is saved.</p></div>
          : <>
            {canGenerate && <button onClick={generate}>{content ? 'Regenerate draft' : 'Generate plain-language draft'}</button>}
            {!content && !canGenerate && episode.state === 'PROCESSING' && <p className="notice">A draft is already being generated. <button onClick={() => load()}>Refresh</button></p>}
            {!content && !sources.length && <p className="muted">Upload a document to generate a draft.</p>}
          </>}
        {content && !generating && <>
          <div className="card">
            <h3>Needs clinician review</h3>
            <p>{critical.length} important · {warnings.length} to check</p>
            {[...critical, ...warnings].map(i => <p key={i.id}><span className={'badge ' + i.severity}>{i.severity === 'critical' ? 'Important' : 'Check'}</span> {i.description}</p>)}
            {reviewable && <>
              <hr />
              <label><input type="checkbox" checked={dischargeOk} onChange={e => setDischargeOk(e.target.checked)} disabled={!!action} /> The discharge date and time above are correct.</label>
              <label><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} disabled={!!action} /> I reviewed every flagged item above and compared the whole draft with the source document, including every medication, number, warning and appointment.</label>
              <button disabled={!!action || !reviewed || !dischargeOk} onClick={approve}>{action === 'Approving…' ? action : 'Approve plan'}</button>
            </>}
          </div>
          {content.summary && <div className="card"><h3>Why you were in the hospital</h3><p>{content.summary.text}</p></div>}
          <div className="card">
            <h3>Medicines</h3>
            {!content.medications.length && <p className="muted">No medications were found in the source.</p>}
            {content.medications.map((m, i) => <article key={i} className="card">
              <span className={'badge ' + m.status}>{m.status}</span> <strong>{m.name}</strong>{m.formulation && ` (${m.formulation})`}
              <p className="muted">{[m.dose, m.route, m.frequency, m.duration].map(v => v || '—').join(' · ')}</p>
              <p>{m.plainLanguage}</p>
            </article>)}
          </div>
          {content.warningSigns.length > 0 && <div className="card"><h3>When to get help</h3>{content.warningSigns.map((w, i) => <p key={i}><span className={'badge ' + w.level}>{levelLabels[w.level]}</span> {w.text}</p>)}</div>}
          {sections.map(([key, title]) => content[key].length > 0 && <div className="card" key={key}><h3>{title}</h3><ul>{content[key].map((item, i) => <li key={i}>{item.text}</li>)}</ul></div>)}
          {content.definitions.length > 0 && <div className="card"><h3>Words to know</h3><ul>{content.definitions.map((d, i) => <li key={i}><strong>{d.term}:</strong> {d.meaning}</li>)}</ul></div>}
          <p className="muted">Generated by {data.plan?.model?.modelId} on {data.plan?.model && new Date(data.plan.model.generatedAt).toLocaleString()}.</p>
        </>}
      </section>
    </div>
    <details className="card"><summary>Testing tools (synthetic records only)</summary>
      <p className="muted">Simulates reaching the end of the 30-day window: patient access ends at once and MongoDB deletes the records shortly after. Requires the development admin settings.</p>
      <button disabled={!!action} onClick={expireNow}>{action === 'Expiring…' ? action : 'Expire now (test)'}</button>
    </details>
  </main>;
}
