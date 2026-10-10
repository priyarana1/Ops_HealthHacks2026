import { redirect } from 'next/navigation';
import { identity } from '@/lib/auth/session';
// Sign-in is rendered outside this protected layout through a separate /signin page.
export default async function ProviderLayout({ children }: {
    children: React.ReactNode;
}) { try {
    await identity('provider');
}
catch {
    redirect('/signin');
} return children; }
