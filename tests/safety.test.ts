import { describe, it, expect } from 'vitest';
import { hash, randomToken, expiration, isExpired, assertPlanAccess, DAYS_30 } from '../src/lib/security/core';
import { validateState } from '../src/lib/epic/state';
import { normalize } from '../src/lib/epic/normalize';
import { planContent, approvalGate, validateEvidence, flagSodiumAsSalt } from '../src/lib/ai/schemas';
import { demoPlan, demoSource } from '../src/lib/ai/demo';
describe('OAuth state', () => { it('accepts only matching, unpredictable state', () => { const s = randomToken(); expect(s.length).toBeGreaterThan(40); expect(validateState(s, hash(s))).toBe(true); expect(validateState(randomToken(), hash(s))).toBe(false); expect(validateState('', hash(s))).toBe(false); }); });
describe('FHIR normalization', () => { it('keeps issuer and FHIR ID without claiming an AVS or inventing data', () => { const p = normalize('https://sandbox.example/FHIR/R4', { resourceType: 'Patient', id: 'fhir-id', name: [{ given: ['Synthetic'], family: 'Example' }] }, [{ resourceType: 'MedicationStatement', status: 'unsupported', resources: [] }]); expect(p.patientId).toBe('fhir-id'); expect(p.displayName).toBe('Synthetic Example'); expect(p.finalizedAvsRetrieved).toBe(false); expect(p.results[0].resources).toEqual([]); }); it('rejects the wrong resource type', () => expect(() => normalize('issuer', { resourceType: 'Encounter', id: 'x' }, [])).toThrow()); });
describe('AI validation and approval', () => { it('validates a synthetic schema without treating it as clinical approval', () => { const p = planContent.parse(demoPlan()); expect(() => validateEvidence(p, demoSource)).not.toThrow(); expect(() => approvalGate(p)).toThrow('high-risk'); p.ambiguityFlags[0].resolution = 'Synthetic source intentionally has no medications.'; expect(() => approvalGate(p)).not.toThrow(); }); it('rejects invented citations and missing fields', () => { const p = demoPlan(); p.sourceReferences[0].quote = 'Invented instruction'; expect(() => validateEvidence(p, demoSource)).toThrow(); expect(() => planContent.parse({ medications: [] })).toThrow(); }); it('rejects ungrounded medication dose', () => { const p = demoPlan(); p.medications.push({ name: 'Drug X', dose: '500 mg', route: 'oral', frequency: 'daily', duration: null, status: 'NEW', patientFriendlyExplanation: 'Example', sourceReference: 'reason' }); expect(() => validateEvidence(p, demoSource)).toThrow(); }); });
describe('Patient authorization and mapping', () => { const plan = { planId: 'a', status: 'published', expiresAt: new Date(Date.now() + 60000) }; it('allows only the matching published plan', () => { expect(() => assertPlanAccess({ planId: 'a' }, plan)).not.toThrow(); expect(() => assertPlanAccess({ planId: 'b' }, plan)).toThrow(); expect(() => assertPlanAccess({}, plan)).toThrow(); expect(() => assertPlanAccess({ planId: 'a' }, { ...plan, status: 'draft' })).toThrow(); }); it('denies expired records even before TTL physically deletes them', () => expect(() => assertPlanAccess({ planId: 'a' }, { ...plan, expiresAt: new Date(0) })).toThrow('expired')); });
describe('Fixed expiration', () => { it('expires exactly 30 days from first storage and denies at the boundary', () => { const created = new Date('2026-10-01T00:00:00Z'); const end = expiration(created); expect(end.getTime() - created.getTime()).toBe(DAYS_30); expect(isExpired(end, new Date(end.getTime() - 1))).toBe(false); expect(isExpired(end, end)).toBe(true); }); });

describe('Sodium is not salt', () => {
    const source = 'Limit sodium to approximately 2 grams per day.';
    const withDiet = (text: string) => { const p = demoPlan(); p.ambiguityFlags = []; p.dailyInstructions = [{ text, sourceReference: 'rest' }]; return p; };
    it('flags patient text that turns sodium into salt and blocks approval', () => { const p = flagSodiumAsSalt(withDiet('Limit salt (sodium) to about 2 grams a day.'), source); expect(p.ambiguityFlags.map(f => f.id)).toEqual(['sodium-written-as-salt']); expect(() => approvalGate(p)).toThrow('high-risk'); });
    it('does not flag text that keeps the word sodium', () => expect(flagSodiumAsSalt(withDiet('Eat no more than about 2 grams of sodium a day.'), source).ambiguityFlags).toEqual([]));
    it('does not flag when the source itself says salt', () => expect(flagSodiumAsSalt(withDiet('Limit salt.'), 'Limit salt and sodium.').ambiguityFlags).toEqual([]));
});

describe('Patient identity mapping', () => {
    it('rejects a mismatched patient even when the plan ID matches', () => {
        expect(() => assertPlanAccess({planId:'a',identity:'other-patient'}, {planId:'a',patientId:'correct-patient',status:'published',expiresAt:new Date(Date.now()+60000)})).toThrow('access denied');
    });
});
