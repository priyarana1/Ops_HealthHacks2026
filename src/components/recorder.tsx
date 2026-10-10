'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from './client-api';
export default function Recorder({ planId, onTranscript, onDemo }: {
    planId: string;
    onTranscript: () => void;
    onDemo: (text: string) => void;
}) {
    const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null), chunks = useRef<Blob[]>([]), timer = useRef<ReturnType<typeof setTimeout> | null>(null), mounted = useRef(true);
    const [availability, setAvailability] = useState<{
        liveEnabled: boolean;
        demoEnabled: boolean;
        message: string;
    }>();
    const [recording, setRecording] = useState(false), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
    useEffect(() => { mounted.current = true; api('audio/status').then(setAvailability).catch(e => setError(e.message)); return () => { mounted.current = false; stream.current?.getTracks().forEach(t => t.stop()); if (timer.current)
        clearTimeout(timer.current); }; }, []);
    async function poll(id: string) { if (!mounted.current)
        return; try {
        const data = await api('audio/jobs/' + encodeURIComponent(id));
        if (data.status === 'COMPLETED') {
            setStatus('Transcript retrieved from Amazon Transcribe Medical. Review and confirm it below.');
            setBusy(false);
            onTranscript();
        }
        else {
            setStatus('Amazon Transcribe Medical: ' + data.status);
            timer.current = setTimeout(() => poll(id), 4000);
        }
    }
    catch (e) {
        setError((e as Error).message);
        setBusy(false);
    } }
    async function start() { setError(''); try {
        if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined')
            throw new Error('Recording requires a browser with MediaRecorder and a secure context.');
        const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(m => MediaRecorder.isTypeSupported(m));
        if (!mime)
            throw new Error('No compatible recording format is supported. Use another browser.');
        stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks.current = [];
        const r = new MediaRecorder(stream.current, { mimeType: mime });
        recorder.current = r;
        r.ondataavailable = e => { if (e.data.size)
            chunks.current.push(e.data); };
        r.onstop = async () => { stream.current?.getTracks().forEach(t => t.stop()); setRecording(false); setBusy(true); try {
            const blob = new Blob(chunks.current, { type: r.mimeType });
            if (!blob.size)
                throw new Error('Recording is empty. Try again.');
            if (blob.size > 25 * 1024 * 1024)
                throw new Error('Recording exceeds 25 MB. Record a shorter instruction.');
            const form = new FormData();
            form.set('planId', planId);
            form.set('audio', blob, 'dictation');
            setStatus('Uploading encrypted temporary audio…');
            const uploaded = await api('audio/upload', 'POST', form);
            const job = await api('audio/transcribe', 'POST', { audioId: uploaded.audioId });
            await poll(job.jobId);
        }
        catch (e) {
            setError((e as Error).message);
            setBusy(false);
        } };
        r.start(1000);
        setRecording(true);
    }
    catch (e) {
        setError((e as Error).name === 'NotAllowedError' ? 'Microphone access was denied. Allow access in browser settings or paste instructions instead.' : (e as Error).message);
    } }
    return <section className="card"><h2>Supplemental clinician dictation</h2><p>Live recording uses encrypted S3 storage and asynchronous Amazon Transcribe Medical. Configured AWS access is required.</p><button disabled={busy || !availability?.liveEnabled} onClick={() => recording ? recorder.current?.stop() : start()}>{recording ? 'Stop and transcribe' : busy ? 'Transcribing…' : 'Record instructions'}</button><p>{availability?.message || 'Checking live transcription configuration…'}</p>{availability?.demoEnabled && <button disabled={busy || recording} onClick={() => { onDemo('SYNTHETIC DEMONSTRATION TRANSCRIPT — no audio was sent to AWS.\nRest at home today.'); setStatus('Synthetic demo text inserted. No transcription request was made.'); }}>Insert synthetic demo transcript (no AWS call)</button>}<p role="status">{status}</p>{error && <p role="alert" className="error">{error}</p>}</section>;
}
