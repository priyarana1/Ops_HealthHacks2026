'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/client-api';
import { Button } from '@/components/ui/button';
export default function SignIn() { const router = useRouter(); const [localEnabled,setLocalEnabled]=useState(false);useEffect(()=>{api('auth/config').then(c=>setLocalEnabled(c.localWorkspaceEnabled)).catch(()=>{});},[]); const [error, setError] = useState(''), [busy, setBusy] = useState(false); return <main style={{ maxWidth: 520 }}><h1>Provider sign in</h1><p>Use your configured ClearPath development account. Epic connection happens separately after sign-in.</p>{localEnabled && <section className="card"><h2>Local synthetic sandbox workspace</h2><p>No provider credentials are configured. This development-only workspace creates a short-lived server-side session on localhost. It does not identify you as an Epic clinician; connect to Epic separately.</p><Button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api('auth/development','POST',{});router.push('/provider');router.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Open local provider workspace</Button></section>}<form className="card" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); const form = new FormData(e.currentTarget); try {
    await api('auth/signin', 'POST', { email: form.get('email'), password: form.get('password') });
    router.push('/provider');
    router.refresh();
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }}><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required/><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required/><Button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>{error && <p role="alert" className="error">{error}</p>}</form></main>; }
