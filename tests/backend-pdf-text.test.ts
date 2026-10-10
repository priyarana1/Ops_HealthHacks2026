import { describe,it,expect } from 'vitest';
import { normalizePdfText } from '../src/lib/backend/documents';
import { sectionHeading,validateClinical,pruneOptionalItems } from '../src/lib/backend/policy';
import type { GeneratedContent,SourceProvenance } from '../src/lib/backend/contracts';
// Shape of pdf-parse output for the synthetic Patient 1 discharge PDF (sample-data/discharge-pdfs).
const raw=['Hospital Course','The patient presented with 5 days of progressive dyspnea, orthopnea, bilateral lower-','extremity edema, and productive cough.','','-- 1 of 3 --','','Discharge Medications','New medications','• \tLosartan 25 mg by mouth once daily for heart failure and blood pressure','control.','• \tAmoxicillin-clavulanate 875/125 mg by mouth twice daily for 3 additional','days to complete treatment for pneumonia.','Continue','• \tMetoprolol succinate 50 mg once daily.','Stopped/held','• \tSpironolactone — held pending repeat renal function and potassium.','• \tFollow a low-sodium diet, generally targeting approximately 2 grams of','sodium daily.','Seek urgent medical attention for:','','-- 2 of 3 --','','• \tChest pain or pressure.'].join('\n');
const text=normalizePdfText(raw);
describe('PDF text normalization',()=>{
 it('rejoins wrapped lines so instructions read as one sentence',()=>{expect(text).toContain('• Follow a low-sodium diet, generally targeting approximately 2 grams of sodium daily.');expect(text).toContain('twice daily for 3 additional days to complete treatment for pneumonia.');expect(text).toContain('blood pressure control.');});
 it('rejoins words hyphenated across a line break',()=>expect(text).toContain('bilateral lower-extremity edema'));
 it('removes page markers and keeps lists that cross a page break together',()=>{expect(text).not.toMatch(/of 3 --/);expect(text).toContain('Seek urgent medical attention for:\n• Chest pain or pressure.');});
 it('keeps headings on their own line and never joins bullets',()=>{expect(text.split('\n')).toEqual(expect.arrayContaining(['Hospital Course','New medications','Continue','Stopped/held','• Metoprolol succinate 50 mg once daily.']));});
 it('changes whitespace only, never words',()=>expect(text.replace(/\s+/g,'')).toBe(raw.replace(/-- \d of 3 --/g,'').replace(/\s+/g,'')));
});
describe('Medication status from section headings',()=>{
 const id='12345678-1234-4234-8234-123456789012',source:SourceProvenance={sourceId:id,kind:'FINAL_AVS',text,createdAt:new Date(),documentType:'application/pdf',transcriptConfirmed:false};
 const blank:GeneratedContent={language:'en',summary:null,hospitalCourse:[],diagnoses:[],medications:[],dailyActions:[],diet:[],fluids:[],activity:[],otherInstructions:[],appointments:[],labsAndMonitoring:[],warningSigns:[],definitions:[],teachBackQuestions:[],practicalBarriers:[],issues:[]};
 const med=(status:'NEW'|'CONTINUE'|'HOLD',quote:string)=>validateClinical({...blank,medications:[{name:quote.split(' ')[0],dose:null,route:null,frequency:null,duration:null,formulation:null,status,notes:'',plainLanguage:'Take as written.',evidence:{sourceId:id,quote}}]},[source]).map(w=>w.id);
 it('finds the nearest heading above a quote',()=>{expect(sectionHeading(text,'Losartan 25 mg')).toBe('New medications');expect(sectionHeading(text,'Metoprolol succinate 50 mg')).toBe('Continue');});
 it('accepts status stated by the heading',()=>{expect(med('NEW','Losartan 25 mg by mouth once daily')).not.toContain('status-0');expect(med('CONTINUE','Metoprolol succinate 50 mg once daily.')).not.toContain('status-0');});
 it('still flags a status the heading contradicts',()=>expect(med('CONTINUE','Losartan 25 mg by mouth once daily')).toContain('status-0'));
 it('accepts a warning level stated by the lead-in line above the bullets',()=>{const issues=validateClinical({...blank,warningSigns:[{text:'Chest pain or pressure.',level:'URGENT',evidence:{sourceId:id,quote:'Chest pain or pressure.'}}]},[source]).map(w=>w.id);expect(issues).not.toContain('escalation-0');});
 it('drops optional definitions with invented numbers instead of failing the run',()=>{const content=pruneOptionalItems({...blank,issues:[],definitions:[{term:'HFrEF',meaning:'Heart pumping below 40%.',evidence:{sourceId:id,quote:'Losartan 25 mg'}},{term:'Losartan',meaning:'A 25 mg pill.',evidence:{sourceId:id,quote:'Losartan 25 mg'}}]});expect(content.definitions.map(d=>d.term)).toEqual(['Losartan']);expect(content.issues.map(i=>i.id)).toEqual(['optional-items-removed']);});
 it('matches a quote that differs from the source only in whitespace',()=>expect(()=>med('HOLD','Spironolactone — held pending repeat renal function\nand potassium.')).not.toThrow());
});
describe('Validator false alarms on real discharge PDFs',()=>{
 const id='12345678-1234-4234-8234-123456789012',quote='Furosemide 40 mg by mouth once daily, unless told otherwise.';
 const src:SourceProvenance={sourceId:id,kind:'FINAL_AVS',text:'New medications\n• '+quote,createdAt:new Date(),documentType:'application/pdf',transcriptConfirmed:false};
 const blank:GeneratedContent={language:'en',summary:null,hospitalCourse:[],diagnoses:[],medications:[],dailyActions:[],diet:[],fluids:[],activity:[],otherInstructions:[],appointments:[],labsAndMonitoring:[],warningSigns:[],definitions:[],teachBackQuestions:[],practicalBarriers:[],issues:[]};
 const med:GeneratedContent['medications'][number]={name:'Furosemide',dose:'40 mg',route:'by mouth',frequency:'once daily',duration:null,formulation:null,status:'NEW',notes:'',plainLanguage:'A new water pill. Take it unless told otherwise.',evidence:{sourceId:id,quote}};
 it('counts the dose field as shown to the patient',()=>expect(validateClinical({...blank,medications:[med]},[src]).map(w=>w.id)).not.toContain('quantity-0'));
 it('does not require background sections to repeat every number or qualifier',()=>expect(validateClinical({...blank,definitions:[{term:'Furosemide',meaning:'A water pill.',evidence:{sourceId:id,quote}}]},[src])).toEqual([]));
 it('still flags an instruction that drops a number',()=>expect(validateClinical({...blank,dailyActions:[{text:'Take your water pill.',evidence:{sourceId:id,quote}}]},[src]).map(w=>w.id)).toContain('quantity-0'));
 it('treats a missing route alone as a warning but a missing dose as critical',()=>{const severity=(m:GeneratedContent['medications'][number])=>validateClinical({...blank,medications:[m]},[src]).find(w=>w.id==='medication-0')?.severity;expect(severity({...med,route:null})).toBe('warning');expect(severity({...med,dose:null})).toBe('critical');});
});
describe('Quote matching ignores typography only',()=>{
 const id='12345678-1234-4234-8234-123456789012',text="Spironolactone — held pending repeat renal function. Weigh daily per the physician's plan.";
 const src:SourceProvenance={sourceId:id,kind:'FINAL_AVS',text,createdAt:new Date(),documentType:'application/pdf',transcriptConfirmed:false};
 const blank:GeneratedContent={language:'en',summary:null,hospitalCourse:[],diagnoses:[],medications:[],dailyActions:[],diet:[],fluids:[],activity:[],otherInstructions:[],appointments:[],labsAndMonitoring:[],warningSigns:[],definitions:[],teachBackQuestions:[],practicalBarriers:[],issues:[]};
 const check=(quote:string)=>()=>validateClinical({...blank,diagnoses:[{text:'Heart failure.',evidence:{sourceId:id,quote}}]},[src]);
 it('accepts curly apostrophes, dash variants and non-breaking spaces',()=>{expect(check('Weigh daily per the physician’s plan.')).not.toThrow();expect(check('Spironolactone - held pending')).not.toThrow();});
 it('still rejects a quote with different words',()=>expect(check('Spironolactone — stopped pending')).toThrow('does not match'));
});
