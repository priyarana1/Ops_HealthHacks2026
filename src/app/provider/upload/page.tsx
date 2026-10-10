'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/components/client-api';
import { DocumentDrop, MAX_UPLOAD_BYTES } from '@/components/document-drop';

const kinds = [
  ['FINAL_AVS', 'Final after-visit summary / discharge instructions'],
  ['DISCHARGE_SUMMARY', 'Discharge summary'],
  ['CLINICIAN_NOTE', 'Clinician note'],
] as const;
const pad = (n: number) => String(n).padStart(2, '0');
const localValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
// The backend needs an explicit UTC offset that matches the named timezone (here, the browser's own).
function withOffset(local: string) {
  const minutes = -new Date(local).getTimezoneOffset(), abs = Math.abs(minutes);
  return `${local}:00${minutes >= 0 ? '+' : '-'}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export default function UploadDischarge() {
  const router = useRouter();
  const [timezone, setTimezone] = useState(''), [dischargeAt, setDischargeAt] = useState(''), [maxDischarge, setMaxDischarge] = useState('');
  const [displayName, setDisplayName] = useState(''), [kind, setKind] = useState<string>('FINAL_AVS'), [file, setFile] = useState<File>();
  const [synthetic, setSynthetic] = useState(false), [dateConfirmed, setDateConfirmed] = useState(false);
  const [status, setStatus] = useState(''), [error, setError] = useState(''), [draftId, setDraftId] = useState('');
  useEffect(() => { const now = localValue(new Date()); setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); setDischargeAt(now); setMaxDischarge(now); }, []);
  const busy = !!status;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!file) return setError('Choose a discharge document to upload.');
    if (file.size > MAX_UPLOAD_BYTES) return setError('The document must be 5 MB or smaller.');
    let planId = draftId;
    try {
      if (!planId) {
        setStatus('Creating the discharge record…');
        planId = (await api('discharges', 'POST', { requestId: crypto.randomUUID(), syntheticConfirmed: true, patient: { displayName: displayName.trim() }, dischargeAt: withOffset(dischargeAt), dischargeTimezone: timezone, dischargeConfirmed: dateConfirmed })).planId;
        setDraftId(planId);
      }
      setStatus('Uploading and reading the document…');
      const form = new FormData();
      form.set('requestId', crypto.randomUUID()); form.set('kind', kind); form.set('file', file);
      await api(`discharges/${planId}/sources`, 'POST', form);
      router.push(`/provider/drafts/${planId}?generate=1`);
    } catch (err) {
      setError((err as Error).message); setStatus('');
    }
  }

  return <main style={{ maxWidth: 760 }}>
    <p><Link href="/provider">← Provider workspace</Link></p>
    <h1>Upload a discharge document</h1>
    <p>Upload the finalized discharge instructions. ClearPath reads the document, saves its text, and drafts plain-language instructions for your review. Nothing reaches the patient until a clinician approves it.</p>
    <form className="card" onSubmit={submit}>
      <label htmlFor="name">Patient display name (synthetic)</label>
      <input id="name" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={100} required disabled={busy || !!draftId} placeholder="e.g. Synthetic Patient A" />
      <label htmlFor="discharged">Discharge date and time</label>
      <input id="discharged" type="datetime-local" value={dischargeAt} max={maxDischarge} onChange={e => setDischargeAt(e.target.value)} required disabled={busy || !!draftId} />
      <p className="muted">Time zone: {timezone || '…'}. The patient’s access ends 30 days after this time.</p>
      <label><input type="checkbox" checked={dateConfirmed} onChange={e => setDateConfirmed(e.target.checked)} disabled={busy || !!draftId} /> I confirm this discharge date and time are correct.</label>
      <label htmlFor="kind">Document type</label>
      <select id="kind" value={kind} onChange={e => setKind(e.target.value)} disabled={busy}>{kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <DocumentDrop file={file} onFile={setFile} disabled={busy} />
      <label><input type="checkbox" checked={synthetic} onChange={e => setSynthetic(e.target.checked)} disabled={busy} required /> I confirm this document contains synthetic data only, not a real patient.</label>
      <button disabled={busy || !synthetic || !file}>{status || (draftId ? 'Retry upload' : 'Upload and read document')}</button>
      {error && <p role="alert" className="error">{error}{draftId && <> The discharge record was created; <Link href={`/provider/discharge/${draftId}`}>open it</Link> or retry the upload.</>}</p>}
      {status && <p role="status" className="muted">{status}</p>}
    </form>
  </main>;
}
