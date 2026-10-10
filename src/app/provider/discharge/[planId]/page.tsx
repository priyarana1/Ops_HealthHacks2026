'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/components/client-api';
import { DocumentDrop } from '@/components/document-drop';
import type { GeneratedContent } from '@/lib/backend/contracts';

interface Snapshot {
  episode: { planId: string; state: string; version: number; dischargeAt: string; dischargeTimezone: string; expiresAt: string; dischargeConfirmed: boolean };
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
  const autoStarted = useRef(false);
  const load = useCallback(async () => setData(await api('discharges/' + planId)), [planId]);

  const generate = useCallback(async () => {
    setGenerating(true); setError(''); setSeconds(0);
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    try { setData(await api(`discharges/${planId}/process`, 'POST', {})); }
    catch (e) { setError((e as Error).message); await load().catch(() => {}); }
    finally { clearInterval(timer); setGenerating(false); }
  }, [planId, load]);

  useEffect(() => {
    load().then(() => {
      if (search.get('generate') && !autoStarted.current) { autoStarted.current = true; router.replace(`/provider/discharge/${planId}`); generate(); }
    }).catch(e => setError(e.message));
  }, [load, generate, planId, router, search]);

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

  return <main>
    <p><Link href="/provider">← Provider workspace</Link></p>
    <div className="row"><h1>{data.patient?.displayName || 'Discharge draft'}</h1><span className="badge">{episode.state.replace('_', ' ')}</span></div>
    <p className="muted">Discharged {new Date(episode.dischargeAt).toLocaleString()} ({episode.dischargeTimezone}) · patient access ends {new Date(episode.expiresAt).toLocaleString()}{!episode.dischargeConfirmed && ' · discharge time not yet confirmed'}</p>
    {error && <p role="alert" className="error">{error}</p>}
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
            <p>{critical.length} must be resolved before approval · {warnings.length} to check</p>
            {[...critical, ...warnings].map(i => <p key={i.id}><span className={'badge ' + i.severity}>{i.severity === 'critical' ? 'Must resolve' : 'Check'}</span> {i.description}</p>)}
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
          <p className="muted">Generated by {data.plan?.model?.modelId} on {data.plan?.model && new Date(data.plan.model.generatedAt).toLocaleString()}. Resolving issues and approval are not on this screen yet.</p>
        </>}
      </section>
    </div>
  </main>;
}
