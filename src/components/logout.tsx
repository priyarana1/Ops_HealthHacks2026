'use client';
import { api } from './client-api';
import { useRouter } from 'next/navigation';
export default function Logout() { const router = useRouter(); return <button onClick={async () => { await api('auth/logout', 'POST'); router.push('/'); router.refresh(); }}>Sign out</button>; }
