'use client';
import { useState } from 'react';
import { Upload } from 'lucide-react';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const accepted = /\.(pdf|docx|txt)$/i;

/** Drag-and-drop or click-to-choose file picker, styled with the portal's design tokens. */
export function DocumentDrop({ file, onFile, disabled }: { file?: File; onFile: (file: File) => void; disabled?: boolean }) {
  const [over, setOver] = useState(false), [error, setError] = useState('');
  const pick = (f?: File) => { if (!f) return; if (!accepted.test(f.name)) return setError('Use a PDF, Word (.docx) or plain-text (.txt) file.'); setError(''); onFile(f); };
  return <>
    <label
      style={{ position: 'relative', display: 'block', border: `2px dashed ${over ? 'var(--primary)' : 'var(--line)'}`, borderRadius: 14, padding: '32px 16px', textAlign: 'center', cursor: disabled ? 'default' : 'pointer', background: over ? 'var(--blue-bg)' : 'var(--panel)' }}
      onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); if (!disabled) pick(e.dataTransfer.files[0]); }}>
      <input type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={disabled} onChange={e => pick(e.target.files?.[0])}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'inherit' }} />
      <Upload size={32} aria-hidden="true" style={{ color: 'var(--primary)' }} />
      {file ? <p style={{ margin: '8px 0 0' }}><b>{file.name}</b> <span className="muted">· {(file.size / 1024).toFixed(0)} KB · click to choose a different file</span></p>
        : <p style={{ margin: '8px 0 0' }}><b>Drag the discharge document here, or click to choose it</b><br /><span className="muted">PDF, Word (.docx) or text, up to 5 MB. Scanned images without text cannot be read.</span></p>}
    </label>
    {error && <p role="alert" style={{ color: 'var(--red-fg)', margin: '8px 0 0' }}>{error}</p>}
  </>;
}
