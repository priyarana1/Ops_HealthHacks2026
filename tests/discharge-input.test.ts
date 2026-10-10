import { describe, it, expect } from 'vitest';
import { dischargeInput } from '../src/lib/discharges/input';
import { sourceText } from '../src/lib/db/plans';
const basic={displayName:'Synthetic Example',syntheticConfirmed:true};
describe('Manual discharge source contract',()=>{
 it('accepts manual chart context without treating it as finalized AVS',()=>{const data=dischargeInput.parse({...basic,uploadedChartText:'Synthetic historical chart.'});expect(data.clinicalInput).toBe('');expect(data.uploadedChartText).toBe('Synthetic historical chart.');});
 it('accepts combined AVS and chart sources',()=>{expect(dischargeInput.parse({...basic,clinicalInput:'Finalized synthetic instructions.',uploadedChartText:'Synthetic chart context.'}).demo).toBe(false);});
 it('requires synthetic confirmation and a non-empty source',()=>{expect(dischargeInput.safeParse({...basic,clinicalInput:'   '}).success).toBe(false);expect(dischargeInput.safeParse({...basic,syntheticConfirmed:false,clinicalInput:'Synthetic text'}).success).toBe(false);});
 it('limits both inputs and prevents mixing a chart with the canned demo',()=>{expect(dischargeInput.safeParse({...basic,uploadedChartText:'x'.repeat(60001)}).success).toBe(false);expect(dischargeInput.safeParse({...basic,demo:true,uploadedChartText:'Different chart'}).success).toBe(false);expect(dischargeInput.safeParse({...basic,demo:true}).success).toBe(true);});
 it('keeps uploaded context separate from authoritative discharge text in AI input',()=>{const source=sourceText({source:{uploadedChartText:'HISTORICAL CHART'},clinicalInput:'FINAL INSTRUCTIONS',transcriptConfirmed:false} as Parameters<typeof sourceText>[0]);expect(source).toContain('MANUALLY UPLOADED SYNTHETIC CHART CONTEXT (not finalized AVS):\nHISTORICAL CHART');expect(source).toContain('FINALIZED SYNTHETIC AVS / CLINICIAN DISCHARGE TEXT:\nFINAL INSTRUCTIONS');});
});
