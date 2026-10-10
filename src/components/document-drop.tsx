'use client';
import { useState } from 'react';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const accepted = /\.(pdf|docx|txt)$/i;

export function DocumentDrop({ file, onFile, disabled }: { file?: File; onFile: (file: File) => void; disabled?: boolean }) {
  const [over, setOver] = useState(false), [error, setError] = useState('');
  const pick = (f?: File) => { if (!f) return; if (!accepted.test(f.name)) return setError('Use a PDF, Word (.docx) or plain-text (.txt) file.'); setError(''); onFile(f); };
  return <>
    <label className={'dropzone' + (over ? ' active' : '')} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); if (!disabled) pick(e.dataTransfer.files[0]); }}>
      <input type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={disabled} onChange={e => pick(e.target.files?.[0])} />
      {file ? <><strong>{file.name}</strong><span className="muted"> · {(file.size / 1024).toFixed(0)} KB · click to choose a different file</span></>
        : <><strong>Drag a discharge document here, or click to choose one</strong><br /><span className="muted">PDF, Word (.docx) or text, up to 5 MB. Scanned images without text cannot be read.</span></>}
    </label>
    {error && <p role="alert" className="error">{error}</p>}
  </>;
}
