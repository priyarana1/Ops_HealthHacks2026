import type { PlanContent } from './schemas';
// Deterministic checks on AI output. They never edit clinical text; each problem becomes a
// high-severity ambiguity flag, which blocks approval until a clinician resolves it.
type Text = { where: string; text: string; quote: string };
const wordNumbers: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', fourteen: '14', thirty: '30' };
const units: Record<string, string> = { mg: 'mg', milligram: 'mg', milligrams: 'mg', mcg: 'mcg', microgram: 'mcg', micrograms: 'mcg', g: 'g', gram: 'g', grams: 'g', kg: 'kg', kilogram: 'kg', kilograms: 'kg', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb', ml: 'ml', l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l', day: 'day', days: 'day', week: 'week', weeks: 'week', month: 'month', months: 'month', hour: 'hour', hours: 'hour', hr: 'hour', hrs: 'hour', minute: 'minute', minutes: 'minute', puff: 'puff', puffs: 'puff' };
const normalize = (text: string) => text.toLowerCase().replace(/(\d),(\d{3})\b/g, '$1$2').replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|thirty)\b/g, w => wordNumbers[w]);
const numbersIn = (text: string) => new Set(normalize(text).match(/\d+(?:[./]\d+)*/g) || []);
const amountsIn = (text: string) => new Set([...normalize(text).matchAll(/(\d+(?:[./]\d+)*)\s*([a-z]+)\b/g)].filter(m => units[m[2]]).map(m => m[1] + ' ' + units[m[2]]));
const timingWords = /\b(morning|evening|night|nightly|bedtime|breakfast|lunch|dinner|meals?|food|empty stomach)\b/gi;
const nightTiming = /\b(evening|night|nightly|bedtime)\b/i;
const conditionWords = /\b(provided|if|unless|pending|until|as long as|as needed|only)\b/i;
function patientTexts(plan: PlanContent): Text[] {
    const quotes = new Map(plan.sourceReferences.map(r => [r.id, r.quote]));
    const sections = { diagnoses: plan.diagnoses, dailyInstructions: plan.dailyInstructions, appointments: plan.appointments, warningSigns: plan.warningSigns, emergencyInstructions: plan.emergencyInstructions };
    return [
        ...(plan.reasonForHospitalization ? [{ where: 'Reason for hospitalization', text: plan.reasonForHospitalization.text, quote: quotes.get(plan.reasonForHospitalization.sourceReference) || '' }] : []),
        ...Object.entries(sections).flatMap(([where, items]) => items.map(i => ({ where, text: i.text, quote: quotes.get(i.sourceReference) || '' }))),
        ...plan.medications.map(m => ({ where: m.name, text: m.patientFriendlyExplanation, quote: quotes.get(m.sourceReference) || '' })),
    ];
}
function flag(plan: PlanContent, id: string, description: string) {
    if (!plan.ambiguityFlags.some(f => f.id === id))
        plan.ambiguityFlags.push({ id, severity: 'high', description, resolution: null });
}
// Sodium and salt are different quantities (2 g sodium is about 5 g salt); a swap changes the instruction.
export function flagSodiumAsSalt(plan: PlanContent, source: string) {
    if (/\bsodium\b/i.test(source) && !/\bsalt\b/i.test(source) && patientTexts(plan).some(t => /\bsalt\b/i.test(t.text)))
        flag(plan, 'sodium-written-as-salt', 'The source says sodium, but the patient text says salt. These are different amounts. Reword to match the source.');
    return plan;
}
// Catches invented thresholds, dates, doses and converted amounts (e.g. "one week" written as "7 days").
export function flagUnsupportedNumbers(plan: PlanContent, source: string) {
    const numbers = numbersIn(source), amounts = amountsIn(source);
    for (const t of patientTexts(plan)) {
        const extra = [...[...numbersIn(t.text)].filter(n => !numbers.has(n)), ...[...amountsIn(t.text)].filter(a => !amounts.has(a))];
        if (extra.length)
            flag(plan, `unsupported-number:${t.where}:${t.text.slice(0, 40)}`, `${t.where}: "${t.text}" contains ${[...new Set(extra)].join(', ')}, which does not appear in the source. Remove it or match the source exactly.`);
    }
    return plan;
}
export function flagMedicationDrift(plan: PlanContent) {
    const quotes = new Map(plan.sourceReferences.map(r => [r.id, r.quote]));
    for (const m of plan.medications) {
        const quote = quotes.get(m.sourceReference) || '', text = m.patientFriendlyExplanation;
        const addedTiming = [...new Set(text.match(timingWords) || [])].filter(w => !new RegExp(`\\b${w}`, 'i').test(quote) && !(nightTiming.test(w) && nightTiming.test(quote)));
        if (addedTiming.length)
            flag(plan, `added-timing:${m.name}`, `${m.name}: the explanation adds "${addedTiming.join('", "')}", but the source does not say when to take it. Keep the source timing (e.g. "once daily").`);
        if (conditionWords.test(quote) && !conditionWords.test(text) && !/\b(when|wait|check|stay|stays|remains)\b/i.test(text))
            flag(plan, `dropped-condition:${m.name}`, `${m.name}: the source has a condition ("${quote}") that the patient explanation leaves out.`);
        if (m.status === 'STOP' && /\b(hold|held|pause|pending)\b/i.test(quote))
            flag(plan, `stop-vs-hold:${m.name}`, `${m.name} is marked STOP, but the source suggests a temporary HOLD ("${quote}").`);
        if (m.status === 'HOLD' && /\b(stop|discontinue|discontinued)\b/i.test(quote) && !/\b(hold|held|pause)\b/i.test(quote))
            flag(plan, `stop-vs-hold:${m.name}`, `${m.name} is marked HOLD, but the source says to stop it ("${quote}").`);
        const pillCount = text.match(/\btake\s+(?:\d+|one|two|three|a|an|half(?: a)?)\s+(?:pill|tablet|capsule)s?\b/i)?.[0];
        if (pillCount && !quote.toLowerCase().includes(pillCount.toLowerCase()))
            flag(plan, `pill-count:${m.name}`, `${m.name}: the explanation says "${pillCount}", but the source gives a strength, not a pill count. Use the dose as written.`);
    }
    return plan;
}
export function runSafetyChecks(plan: PlanContent, source: string) {
    return flagMedicationDrift(flagUnsupportedNumbers(flagSodiumAsSalt(plan, source), source));
}
