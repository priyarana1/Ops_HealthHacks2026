// Nurse upload flow against the running app: create a discharge, upload a PDF/DOCX/TXT,
// run real Bedrock processing, print the draft for review, then expire the synthetic episode.
// Usage: npm run backend:upload -- <file> [--keep] [--json]
// Needs: `npm run dev` running and DEV_PROVIDER_EMAIL/PASSWORD. Cleanup also needs
// DEV_PROVIDER_ADMIN=true and ENABLE_EXPIRATION_TEST=true (TTL then deletes the records).
import nextEnv from '@next/env';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
nextEnv.loadEnvConfig(process.cwd(), true);

const file = process.argv.slice(2).find(a => !a.startsWith('--'));
const keep = process.argv.includes('--keep'), asJson = process.argv.includes('--json');
if (!file) { console.error('Usage: npm run backend:upload -- <file.pdf|.docx|.txt> [--keep] [--json]'); process.exit(1); }
const base = process.env.APP_URL || 'http://localhost:3000', cookies = new Map();
const types = { '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.txt': 'text/plain' };

async function api(path, method = 'GET', body) {
  const isForm = body instanceof FormData;
  const response = await fetch(base + '/api/' + path, { method, headers: { origin: base, cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...(isForm || body === undefined ? {} : { 'content-type': 'application/json' }) }, body: isForm ? body : body === undefined ? undefined : JSON.stringify(body) });
  for (const c of response.headers.getSetCookie()) { const pair = c.split(';')[0], i = pair.indexOf('='); cookies.set(pair.slice(0, i), pair.slice(i + 1)); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} /api/${path} -> HTTP ${response.status}: ${data.error || 'request failed'}`);
  return data;
}

let planId;
try {
  await api('auth/signin', 'POST', { email: process.env.DEV_PROVIDER_EMAIL, password: process.env.DEV_PROVIDER_PASSWORD });
  const draft = await api('discharges', 'POST', { requestId: randomUUID(), syntheticConfirmed: true, patient: { displayName: 'Synthetic upload ' + basename(file) }, dischargeAt: new Date(Date.now() - 3600000).toISOString(), dischargeTimezone: 'UTC', dischargeConfirmed: false });
  planId = draft.planId;
  const form = new FormData();
  form.set('requestId', randomUUID()); form.set('kind', 'FINAL_AVS');
  form.set('file', new Blob([await readFile(file)], { type: types[extname(file).toLowerCase()] || '' }), basename(file));
  const uploaded = await api(`discharges/${planId}/sources`, 'POST', form);
  const { sources } = await api(`discharges/${planId}/sources`);
  console.log(`Uploaded ${basename(file)} -> source ${uploaded.sourceId} (${uploaded.documentType}, ${sources[0].text.length} chars stored in MongoDB, original in S3: ${uploaded.originalStored})`);
  const start = Date.now();
  const result = await api(`discharges/${planId}/process`, 'POST', {});
  const c = result.plan.content;
  console.log(`Bedrock processed in ${((Date.now() - start) / 1000).toFixed(1)}s, state ${result.episode.state}\n`);
  if (asJson) console.log(JSON.stringify(c, null, 2));
  else {
    console.log('MEDICATIONS');
    for (const m of c.medications) console.log(`  ${m.status.padEnd(8)} ${m.name} | ${m.dose ?? '-'} | ${m.route ?? '-'} | ${m.frequency ?? '-'} | ${m.duration ?? '-'}\n           -> ${m.plainLanguage}`);
    for (const key of ['diagnoses', 'dailyActions', 'diet', 'fluids', 'activity', 'otherInstructions', 'appointments', 'labsAndMonitoring'])
      if (c[key].length) console.log(key.toUpperCase() + '\n' + c[key].map(i => '  - ' + i.text).join('\n'));
    console.log('WARNING SIGNS\n' + c.warningSigns.map(w => `  [${w.level}] ${w.text}`).join('\n'));
    console.log(`ISSUES (${c.issues.length})\n` + c.issues.map(i => `  ${i.severity.padEnd(8)} ${i.id}: ${i.description}`).join('\n'));
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e); process.exitCode = 1;
} finally {
  if (planId && keep) console.log(`\nKept plan ${planId} for review (expires 30 days after discharge).`);
  else if (planId) {
    await api(`discharges/${planId}/expire-test`, 'POST', {}).then(() => console.log('\nTest episode expired; MongoDB TTL removes it within about a minute.')).catch(e => console.error('Cleanup failed: ' + e.message));
    if (process.env.PURGE_SECRET) await fetch(base + '/api/internal/backend-cleanup', { method: 'POST', headers: { authorization: 'Bearer ' + process.env.PURGE_SECRET } });
  }
  await api('auth/logout', 'POST', {}).catch(() => {});
}
