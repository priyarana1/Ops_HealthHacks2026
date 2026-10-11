import { describe,it,expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { extractDocument } from '../src/lib/backend/documents';
import { demoFixtureContent,demoFixtureSource,DEMO_SPANISH } from '../src/lib/backend/demo-fixture';
import { validateClinical } from '../src/lib/backend/policy';
import { translatableFields,lineProblems,applyTranslation } from '../src/lib/backend/translation';
import type { SourceProvenance } from '../src/lib/backend/contracts';

const sourceFor=async(file:string):Promise<SourceProvenance>=>{const {text,documentType}=await extractDocument(file,'application/pdf',await readFile('sample-data/discharge-pdfs/'+file));return {sourceId:'12345678-1234-4234-8234-123456789012',kind:'FINAL_AVS',text,createdAt:new Date(),documentType,transcriptConfirmed:false};};

describe('Pre-reviewed demo fixture for the Example 1 PDF',()=>{
 it('applies only to the Example 1 document, alone',async()=>{
  const p1=await sourceFor('Patient_1_HFrEF_Pneumonia_AKI.pdf'),p3=await sourceFor('Patient_3_HFpEF_Atrial_Fibrillation_Cellulitis.pdf');
  expect(demoFixtureSource([p1])).toBe(p1);expect(demoFixtureSource([p3])).toBeUndefined();
  expect(demoFixtureSource([p1,{...p3,sourceId:'22345678-1234-4234-8234-123456789012'}])).toBeUndefined();
 });
 it('passes the clinical validator with only the expected review flags',async()=>{
  const sources=[await sourceFor('Patient_1_HFrEF_Pneumonia_AKI.pdf')],content=demoFixtureContent(sources)!;
  expect(()=>validateClinical(content,sources)).not.toThrow();
  const critical=content.issues.filter(i=>i.severity==='critical').map(i=>i.id);
  expect(critical).toEqual(['review-wording:medications.7.plainLanguage','review-wording:medications.9.plainLanguage','review-wording:diet.0.text','source-completeness']);
  expect(content.issues.filter(i=>i.severity!=='critical')).toEqual([]);
  expect(content.medications.map(m=>[m.name,m.status])).toEqual([['Furosemide','NEW'],['Losartan','NEW'],['Empagliflozin','NEW'],['Amoxicillin-clavulanate','NEW'],['Metoprolol succinate','CONTINUE'],['Apixaban','CONTINUE'],['Atorvastatin','CONTINUE'],['Metformin','CONTINUE'],['Lisinopril','STOP'],['Spironolactone','HOLD'],['Ibuprofen/other NSAIDs','STOP']]);
  // Pill counts are supplied by the fixture (as pharmacy data), only for medicines the patient takes.
  expect(content.medications.map(m=>m.tabletCount)).toEqual([1,1,1,1,1,1,1,1,undefined,undefined,undefined]);
  // The patient to-do is only simple daily actions; medicine-taking is covered by the medicine checklist.
  expect([...content.dailyActions,...content.otherInstructions].map(i=>i.text)).toEqual(['Weigh yourself each morning and write it down.']);
 });
 it('has Spanish for every translatable line, with numbers and medicine names unchanged',async()=>{
  const sources=[await sourceFor('Patient_1_HFrEF_Pneumonia_AKI.pdf')],content=demoFixtureContent(sources)!;
  const fields=translatableFields(content),names=content.medications.map(m=>m.name);
  expect(fields.map(f=>f.path).filter(p=>!DEMO_SPANISH[p])).toEqual([]);
  for(const f of fields)expect([f.path,lineProblems(f.text,DEMO_SPANISH[f.path],undefined,names)]).toEqual([f.path,[]]);
  expect(applyTranslation(content,fields.map(f=>({path:f.path,text:DEMO_SPANISH[f.path]}))).medications[3]).toMatchObject({name:'Amoxicillin-clavulanate',dose:'875/125 mg',frequency:'dos veces al día'});
 });
});
