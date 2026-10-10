import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from './core';
export function originCheck(req: NextRequest) { if (!['GET', 'HEAD'].includes(req.method) && req.headers.get('origin') !== new URL(process.env.APP_URL || 'http://localhost:3000').origin)
    throw new AppError(403, 'Invalid request origin.'); }
export function handler(fn: (req: NextRequest) => Promise<unknown>, options: {
    internal?: boolean;
} = {}) { return async (req: NextRequest) => { try {
    if (!options.internal)
        originCheck(req);
    const result = await fn(req);
    return result instanceof Response ? result : NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
catch (e) {
    return NextResponse.json({ error: e instanceof AppError || e instanceof ZodError ? e.message : 'The request failed. Check server configuration or service availability.' }, { status: e instanceof AppError ? e.status : e instanceof ZodError ? 400 : 503 });
} }; }
