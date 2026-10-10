import './globals.css';
import Link from 'next/link';
import { HeartPulse } from 'lucide-react';
export const metadata = { title: 'ClearPath — Synthetic Discharge Prototype', description: 'Clinician-reviewed discharge instructions. Synthetic data only.' };
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en"><body><header><Link href="/" className="row"><HeartPulse aria-hidden="true"/>ClearPath</Link><span className="badge">Synthetic data only</span><nav className="row" aria-label="Main"><Link href="/provider">Provider portal</Link><Link href="/patient">Patient access</Link></nav></header>{children}</body></html>; }
