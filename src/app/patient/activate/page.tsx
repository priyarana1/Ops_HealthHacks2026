'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/client-api';
export default function Activate() {
    const router = useRouter();
    const [token, setToken] = useState(''), [otp, setOtp] = useState(''), [ready, setReady] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    useEffect(() => { const value = new URLSearchParams(window.location.hash.slice(1)).get('token') || ''; setToken(value); window.history.replaceState(null, '', window.location.pathname); if (!value) {
        setError('Open the full invitation link from your care team.');
        return;
    } api('patient/activate', 'POST', { token: value }).then(() => setReady(true)).catch(e => setError(e.message)); }, []);
    return <main className="patient"><h1>Open your recovery plan</h1><form className="card" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try {
        await api('patient/verify', 'POST', { token, otp });
        router.replace('/patient/dashboard');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }}><p>Enter the six-digit code from your care team. Your code expires after ten minutes.</p><label htmlFor="otp">Verification code</label><input id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e => setOtp(e.target.value)} required/><button disabled={busy || !ready}>{busy ? 'Checking code…' : 'Open my plan'}</button>{error && <p className="error" role="alert">{error}</p>}</form></main>;
}
