// Runs synthetic discharge notes through the running app (real Bedrock), grades the output,
// then deletes each test plan with the synthetic expiration endpoint.
// Usage: npm run eval:ai [-- --only=<case-id>] [-- --show]
// Needs: `npm run dev` running, DEV_PROVIDER_EMAIL/PASSWORD, DEV_PROVIDER_ADMIN=true, ENABLE_EXPIRATION_TEST=true.
import nextEnv from '@next/env';
import { cases } from './eval-cases.mjs';
nextEnv.loadEnvConfig(process.cwd(), true);

const base = process.env.APP_URL || 'http://localhost:3000';
const only = process.argv.find(a => a.startsWith('--only='))?.split('=')[1];
const show = process.argv.includes('--show');
const checkFlag = /^(sodium-written-as-salt|unsupported-number|added-timing|dropped-condition|stop-vs-hold|pill-count)/;

async function call(path, method = 'GET', body, cookie) {
  const response = await fetch(base + '/api/' + path, { method, headers: { 'content-type': 'application/json', origin: base, ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${data.error || 'no message'}`);
  return { data, response };
}

function patientTexts(s) {
  return [s.reasonForHospitalization?.text, ...[...s.diagnoses, ...s.dailyInstructions, ...s.appointments, ...s.warningSigns, ...s.emergencyInstructions].map(i => i.text), ...s.medications.map(m => m.patientFriendlyExplanation)].filter(Boolean);
}

function grade(expect, s) {
  const fails = [], texts = patientTexts(s), all = texts.join('\n'), re = r => new RegExp(r, 'i');
  for (const e of expect.meds || []) {
    const m = s.medications.find(m => re(e.name).test(m.name));
    if (!m) { fails.push(`missing medication /${e.name}/`); continue; }
    if (e.status && ![].concat(e.status).includes(m.status)) fails.push(`${m.name}: status ${m.status}, expected ${[].concat(e.status).join(' or ')}`);
    for (const k of ['dose', 'route', 'frequency', 'duration'])
      if (e[k] && !(m[k] || '').toLowerCase().includes(e[k].toLowerCase())) fails.push(`${m.name}: ${k} is ${JSON.stringify(m[k])}, expected to contain "${e[k]}"`);
    if (e.explains && !re(e.explains).test(m.patientFriendlyExplanation)) fails.push(`${m.name}: explanation "${m.patientFriendlyExplanation}" should mention /${e.explains}/`);
  }
  for (const e of expect.notStatus || [])
    for (const m of s.medications.filter(m => re(e.name).test(m.name)))
      if (e.status.includes(m.status)) fails.push(`${m.name} should not be ${m.status}`);
  for (const name of expect.absentMeds || [])
    if (s.medications.some(m => re(name).test(m.name))) fails.push(`/${name}/ should not be in the medication list`);
  for (const r of expect.mentions || []) if (!re(r).test(all)) fails.push(`patient text never mentions /${r}/`);
  for (const r of expect.forbid || []) { const hit = texts.find(t => re(r).test(t)); if (hit) fails.push(`forbidden /${r}/ in: "${hit}"`); }
  const flagText = s.ambiguityFlags.map(f => f.description).join('\n');
  for (const r of [...(expect.flags || []), ...(expect.flagsAlso || [])]) if (!re(r).test(flagText)) fails.push(`expected an ambiguity flag mentioning /${r}/`);
  if (expect.noDoses && s.medications.some(m => m.dose || m.frequency)) fails.push('a dose or frequency was filled in although the source gives none');
  if (expect.minHighFlags && s.ambiguityFlags.filter(f => f.severity === 'high').length < expect.minHighFlags) fails.push(`expected at least ${expect.minHighFlags} high-severity flag(s)`);
  return fails;
}

const signin = await call('auth/signin', 'POST', { email: process.env.DEV_PROVIDER_EMAIL, password: process.env.DEV_PROVIDER_PASSWORD });
const cookie = (signin.response.headers.get('set-cookie') || '').split(';')[0];
const results = [];
for (const c of cases.filter(c => !only || c.id === only)) {
  let planId, row = { id: c.id, ok: false, seconds: 0, fails: [], caught: [], high: 0 };
  try {
    ({ planId } = (await call('discharges', 'POST', { displayName: 'Synthetic eval ' + c.id, clinicalInput: c.avs, syntheticConfirmed: true }, cookie)).data);
    if (c.transcript) {
      const draft = (await call('discharges/' + planId, 'GET', undefined, cookie)).data;
      await call('discharges/' + planId, 'PATCH', { revision: draft.revision, transcript: c.transcript, transcriptConfirmed: true }, cookie);
    }
    const start = Date.now();
    const s = (await call(`discharges/${planId}/process`, 'POST', { demo: false }, cookie)).data.structured;
    row.seconds = (Date.now() - start) / 1000;
    row.fails = grade(c.expect, s);
    row.caught = s.ambiguityFlags.filter(f => checkFlag.test(f.id)).map(f => f.description);
    row.high = s.ambiguityFlags.filter(f => f.severity === 'high').length;
    row.ok = row.fails.length === 0;
    if (show) console.log(`\n=== ${c.id} structured output\n` + JSON.stringify(s, null, 2));
  } catch (e) {
    row.fails.push(e.message);
  } finally {
    if (planId) await call(`discharges/${planId}/expire-test`, 'POST', {}, cookie).catch(e => row.fails.push('cleanup failed: ' + e.message));
  }
  results.push(row);
  console.log(`\n${row.ok ? 'PASS' : 'FAIL'}  ${c.id} — ${c.title} (${row.seconds.toFixed(1)}s, ${row.high} high flags)`);
  for (const f of row.fails) console.log('   ✗ ' + f);
  for (const f of row.caught) console.log('   ⚑ caught by code check: ' + f);
}
await call('auth/logout', 'POST', {}, cookie).catch(() => {});
console.log(`\n${results.filter(r => r.ok).length}/${results.length} cases passed. ${results.reduce((n, r) => n + r.caught.length, 0)} problem(s) caught by code checks.`);
process.exitCode = results.every(r => r.ok) ? 0 : 1;
