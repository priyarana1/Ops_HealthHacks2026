import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export const randomToken = () => randomBytes(32).toString('base64url');
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function equal(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
export const DAYS_30 = 30 * 24 * 60 * 60 * 1000;
export const expiration = (date: Date) => new Date(date.getTime() + DAYS_30);
export const isExpired = (value: Date | string, now = new Date()) => new Date(value).getTime() <= now.getTime();
export class AppError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}
export function assertActive(expiresAt: Date | string) { if (isExpired(expiresAt))
    throw new AppError(410, 'This recovery record has expired.'); }
export function assertPlanAccess(session: {
    planId?: string;
    identity?: string;
}, plan: {
    planId: string;
    patientId?: string;
    status: string;
    expiresAt: Date | string;
}) { assertActive(plan.expiresAt); if (session.planId !== plan.planId || (session.identity !== undefined && session.identity !== plan.patientId) || plan.status !== 'published')
    throw new AppError(403, 'Plan access denied.'); }
