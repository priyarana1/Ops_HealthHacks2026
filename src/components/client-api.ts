'use client';
export async function api(path: string, method = 'GET', body?: unknown) { const response = await fetch('/api/' + path, { method, headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), cache: 'no-store' }); const data = await response.json(); if (!response.ok)
    throw new Error(data.error || 'Request failed.'); return data; }
