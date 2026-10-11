import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { handler } from '@/lib/security/http';
import { AppError, hash } from '@/lib/security/core';
import { cookieSession, identity, issueSession, limit, revokeSession } from '@/lib/auth/session';
import { epicStore } from '@/lib/epic/store';
import { localWorkspaceEnabled } from '@/lib/auth/development';
export const runtime = 'nodejs';

// Provider sign-in, sign-out and session endpoints under /api/auth/*. Discharge, patient and audio
// APIs live in their own route folders (src/lib/backend); Epic in /api/epic.
const credentials = z.object({ email: z.string().email(), password: z.string().min(1).max(200) }).strict();
const json = (r: NextRequest) => r.json().catch(() => { throw new AppError(400, 'Invalid JSON request.'); });
async function dispatch(req: NextRequest) {
    const path = req.nextUrl.pathname.replace(/^\/api\//, '');
    const method = req.method;
    if(path==='auth/config' && method==='GET') return {localWorkspaceEnabled:localWorkspaceEnabled(),storage:process.env.NODE_ENV==='production'?'database':'server-memory'};
    if(path==='auth/development' && method==='POST') {
        if(!localWorkspaceEnabled() || !['localhost','127.0.0.1','[::1]'].includes(req.nextUrl.hostname)) throw new AppError(403,'Local synthetic workspace is only available on loopback in development without configured provider credentials.');
        await issueSession('provider','Local synthetic sandbox workspace',new Date(Date.now()+8*3600000));return {ok:true};
    }
    if (path === 'auth/signin' && method === 'POST') {
        const data = credentials.parse(await json(req));
        await limit('provider-signin', 20);
        const email = process.env.DEV_PROVIDER_EMAIL;
        const raw = process.env.DEV_PROVIDER_PASSWORD;
        const stored = process.env.DEV_PROVIDER_PASSWORD_HASH;
        if (!email || (!stored && (!raw || process.env.NODE_ENV === 'production')))
            throw new AppError(503, 'Configure development provider credentials; production requires a password hash.');
        const passwordHash = stored || await bcrypt.hash(raw!, 12);
        if (data.email.toLowerCase() !== email.toLowerCase() || !(await bcrypt.compare(data.password, passwordHash)))
            throw new AppError(401, 'Invalid sign-in credentials.');
        await issueSession('provider', email.toLowerCase(), new Date(Date.now() + 8 * 3600000), undefined, process.env.DEV_PROVIDER_ADMIN === 'true');
        return { ok: true };
    }
    if (path === 'auth/logout' && method === 'POST') {
        const cookie = await cookieSession();
        if (cookie.token) {
            await epicStore.disconnect(hash(cookie.token));
            await revokeSession(hash(cookie.token));
        }
        cookie.destroy();
        return { ok: true };
    }
    if (path === 'auth/me' && method === 'GET')
        return { role: 'provider', email: (await identity('provider')).identity };
    throw new AppError(404, 'Endpoint not found.');
}
const route = handler(dispatch);
export const GET = route;
export const POST = route;
