// Runs synthetic discharge notes through the running app's real AI pipeline, grades the output,
// then expires each test discharge (MongoDB TTL deletes it shortly after).
// Usage: npm run eval:ai [-- --only=<case-id>] [-- --show]
// Needs: `npm run dev` running, DEV_PROVIDER_EMAIL/PASSWORD, DEV_PROVIDER_ADMIN=true, ENABLE_EXPIRATION_TEST=true.
import nextEnv from '@next/env';
import { randomUUID } from 'node:crypto';
import { cases } from './eval-cases.mjs';
nextEnv.loadEnvConfig(process.cwd(), true);

const base = process.env.APP_URL || 'http://localhost:3000';
const only = process.argv.find(a => a.startsWith('--only='))?.split('=')[1];
const show = process.argv.includes('--show');
// Deterministic checks that caught or rejected a problem in the AI output.
const checkFlag = /^(sodium-as-salt|added-timing|pill-count|source-wording-retained|unverified-medication|source-conflict)-/;

async function call(path, method = 'GET', body, cookie) {
  const response = await fetch(base + '/api/' + path, { method, headers: { 'content-type': 'application/json', origin: base, ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${data.error || 'no message'}`);
  return { data, response };
}

function patientTexts(c) {
  const sections = ['diagnoses', 'dailyActions', 'diet', 'fluids', 'activity', 'otherInstructions', 'appointments', 'labsAndMonitoring', 'warningSigns'];
  return [c.summary?.text, ...sections.flatMap(s => c[s].map(i => i.text)), ...c.medications.map(m => m.plainLanguage)].filter(Boolean);
}

function grade(expect, c) {
  const fails = [], texts = patientTexts(c), all = texts.join('\n'), re = r => new RegExp(r, 'i');
  for (const e of expect.meds || []) {
    const m = c.medications.find(m => re(e.name).test(m.name + ' ' + (m.formulation || '')));
    if (!m) { fails.push(`missing medication /${e.name}/`); continue; }
    if (e.status && ![].concat(e.status).includes(m.status)) fails.push(`${m.name}: status ${m.status}, expected ${[].concat(e.status).join(' or ')}`);
    for (const k of ['dose', 'route', 'frequency', 'duration'])
      if (e[k] && !(m[k] || '').toLowerCase().includes(e[k].toLowerCase())) fails.push(`${m.name}: ${k} is ${JSON.stringify(m[k])}, expected to contain "${e[k]}"`);
    if (e.explains && !re(e.explains).test(m.plainLanguage)) fails.push(`${m.name}: explanation "${m.plainLanguage}" should mention /${e.explains}/`);
  }
  for (const e of expect.notStatus || [])
    for (const m of c.medications.filter(m => re(e.name).test(m.name)))
      if (e.status.includes(m.status)) fails.push(`${m.name} should not be ${m.status}`);
  for (const name of expect.absentMeds || [])
    if (c.medications.some(m => re(name).test(m.name))) fails.push(`/${name}/ should not be in the medication list`);
  for (const r of expect.mentions || []) if (!re(r).test(all)) fails.push(`patient text never mentions /${r}/`);
  for (const r of expect.forbid || []) { const hit = texts.find(t => re(r).test(t)); if (hit) fails.push(`forbidden /${r}/ in: "${hit}"`); }
  const flagText = c.issues.map(f => f.description).join('\n');
  for (const r of [...(expect.flags || []), ...(expect.flagsAlso || [])]) if (!re(r).test(flagText)) fails.push(`expected a review flag mentioning /${r}/`);
  if (expect.noDoses && c.medications.some(m => m.dose || m.frequency)) fails.push('a dose or frequency was filled in although the source gives none');
  // source-completeness is always present, so it does not count towards flags the AI raised.
  const critical = c.issues.filter(f => f.severity === 'critical' && f.id !== 'source-completeness').length;
  if (expect.minHighFlags && critical < expect.minHighFlags) fails.push(`expected at least ${expect.minHighFlags} critical flag(s) besides source completeness`);
  return fails;
}

const signin = await call('auth/signin', 'POST', { email: process.env.DEV_PROVIDER_EMAIL, password: process.env.DEV_PROVIDER_PASSWORD });
const cookie = (signin.response.headers.get('set-cookie') || '').split(';')[0];
const results = [];
for (const c of cases.filter(c => !only || c.id === only)) {
  let planId, row = { id: c.id, ok: false, seconds: 0, fails: [], caught: [], critical: 0 };
  try {
    ({ planId } = (await call('discharges', 'POST', { requestId: randomUUID(), syntheticConfirmed: true, patient: { displayName: 'Synthetic eval ' + c.id }, dischargeAt: new Date(Date.now() - 3600000).toISOString(), dischargeTimezone: 'UTC', dischargeConfirmed: true, clinicalInput: c.avs, sourceKind: 'FINAL_AVS' }, cookie)).data);
    if (c.transcript) await call(`discharges/${planId}/sources`, 'POST', { requestId: randomUUID(), kind: 'AUDIO_TRANSCRIPT', text: c.transcript, transcriptConfirmed: true }, cookie);
    const start = Date.now();
    const content = (await call(`discharges/${planId}/process`, 'POST', {}, cookie)).data.plan.content;
    row.seconds = (Date.now() - start) / 1000;
    row.fails = grade(c.expect, content);
    row.caught = content.issues.filter(f => checkFlag.test(f.id)).map(f => f.description);
    row.critical = content.issues.filter(f => f.severity === 'critical').length;
    row.ok = row.fails.length === 0;
    if (show) console.log(`\n=== ${c.id} structured output\n` + JSON.stringify(content, null, 2));
  } catch (e) {
    row.fails.push(e.message);
  } finally {
    if (planId) await call(`discharges/${planId}/expire-test`, 'POST', {}, cookie).catch(e => row.fails.push('cleanup failed: ' + e.message));
  }
  results.push(row);
  console.log(`\n${row.ok ? 'PASS' : 'FAIL'}  ${c.id} — ${c.title} (${row.seconds.toFixed(1)}s, ${row.critical} critical flags)`);
  for (const f of row.fails) console.log('   ✗ ' + f);
  for (const f of row.caught) console.log('   ⚑ caught by code check: ' + f);
}
await call('auth/logout', 'POST', {}, cookie).catch(() => {});
console.log(`\n${results.filter(r => r.ok).length}/${results.length} cases passed. ${results.reduce((n, r) => n + r.caught.length, 0)} problem(s) caught by code checks.`);
process.exitCode = results.every(r => r.ok) ? 0 : 1;
