import {describe,it,expect} from 'vitest';
import {applyRewrites,applyValidatedRewrites,requireVerbatimExtraction} from '../src/lib/backend/simplification';
import {sourceInput,type GeneratedContent} from '../src/lib/backend/contracts';
import {extractDocument} from '../src/lib/backend/documents';
import {validateClinical,approvalIssues} from '../src/lib/backend/policy';
const sourceId='12345678-1234-4234-8234-123456789012',quote='NEW Furosemide 40 mg PO daily.';
const extraction:GeneratedContent={language:'en',summary:null,hospitalCourse:[],diagnoses:[],medications:[{name:'Furosemide',dose:'40 mg',route:'PO',frequency:'daily',duration:null,formulation:null,status:'NEW',notes:'',plainLanguage:quote,evidence:{sourceId,quote}}],dailyActions:[],diet:[],fluids:[],activity:[],otherInstructions:[],appointments:[],labsAndMonitoring:[],warningSigns:[],definitions:[],teachBackQuestions:[],practicalBarriers:[],issues:[]};
describe('Separate verbatim extraction and prose simplification',()=>{
 it('retains original text whitespace during ingestion',()=>{const text='  Synthetic source\n\nNEW medicine.\n';expect(sourceInput.parse({requestId:sourceId,kind:'FINAL_AVS',text}).text).toBe(text);});
 it('preserves UTF-8 TXT leading/trailing whitespace during file extraction',async()=>{const text='  Synthetic discharge summary.\r\n\r\n';expect((await extractDocument('chart.txt','text/plain',Buffer.from(text))).text).toBe(text);});
 it('requires a source-faithful first stage',()=>{expect(()=>requireVerbatimExtraction(extraction)).not.toThrow();expect(()=>requireVerbatimExtraction({...extraction,medications:[{...extraction.medications[0],plainLanguage:'Take by mouth.'}]})).toThrow('medications.0.plainLanguage');});
 it('allows prose shortening while retaining verbatim structured medication values and evidence',()=>{const result=applyRewrites(extraction,{rewrites:[{path:'medications.0.plainLanguage',text:'Take Furosemide 40 mg by mouth daily.'}]});expect(result.medications[0].route).toBe('PO');expect(result.medications[0].dose).toBe('40 mg');expect(result.medications[0].evidence).toEqual(extraction.medications[0].evidence);expect(extraction.medications[0].plainLanguage).toBe(quote);});
 it('rejects attempts to change orders, source evidence, add fields or duplicate rewrites',()=>{for(const path of ['medications.0.dose','medications.0.status','medications.0.evidence.quote','__proto__.text','dailyActions.0.text'])expect(()=>applyRewrites(extraction,{rewrites:[{path,text:'changed'}]})).toThrow('existing prose');expect(()=>applyRewrites(extraction,{rewrites:[{path:'medications.0.plainLanguage',text:'a'},{path:'medications.0.plainLanguage',text:'b'}]})).toThrow();});
 it('adds safety flags as unresolved issues without allowing approval or resolution fields',()=>{
  const result=applyRewrites(extraction,{rewrites:[],flags:[{id:'missing-duration',severity:'critical',description:'Duration needs clinician clarification.'}]});
  expect(result.issues).toContainEqual({id:'simplification-missing-duration',severity:'critical',description:'Duration needs clinician clarification.',resolution:null});
  expect(()=>applyRewrites(extraction,{rewrites:[],flags:[{id:'unsafe',severity:'critical',description:'Missing value',resolution:'approved'}]})).toThrow();
  expect(()=>applyRewrites(extraction,{rewrites:[],approvalStatus:'APPROVED'})).toThrow();
 });
 it('rejects only unsafe paraphrases, retains their source wording, and blocks approval',()=>{
  const text=quote+'\nContact your team for swelling.';
  const base={...extraction,warningSigns:[{text:'Contact your team for swelling.',level:'CONTACT_CARE_TEAM' as const,evidence:{sourceId,quote:'Contact your team for swelling.'}}]};
  const sources=[{sourceId,kind:'FINAL_AVS' as const,text,createdAt:new Date(),documentType:'text/plain',transcriptConfirmed:false}];
  const result=applyValidatedRewrites(base,{rewrites:[{path:'warningSigns.0.text',text:'Call for 3 lb weight gain.'},{path:'medications.0.plainLanguage',text:'Take Furosemide 40 mg by mouth daily.'}]},sources);
  expect(result.rejectedPaths).toEqual(['warningSigns.0.text']);
  expect(result.content.warningSigns[0].text).toBe(base.warningSigns[0].text);
  expect(result.content.medications[0].plainLanguage).toContain('by mouth');
  expect(()=>validateClinical(result.content,sources)).not.toThrow();
  expect(()=>approvalIssues(result.content)).toThrow('Resolve');
  expect(base.warningSigns[0].text).toBe('Contact your team for swelling.');
 });
 it('retains the original medication wording when a rewrite invents a dose',()=>{
  const source={sourceId,kind:'FINAL_AVS' as const,text:quote,createdAt:new Date(),documentType:'text/plain',transcriptConfirmed:false};
  const result=applyValidatedRewrites(extraction,{rewrites:[{path:'medications.0.plainLanguage',text:'Take 80 mg daily.'}]},[source]);
  expect(result.rejectedPaths).toEqual(['medications.0.plainLanguage']);expect(result.content.medications[0].plainLanguage).toBe(quote);expect(result.content.medications[0].dose).toBe('40 mg');
 });
 it('does not hide invalid extraction evidence or malformed rewrite paths',()=>{
  expect(()=>applyValidatedRewrites(extraction,{rewrites:[]},[])).toThrow('evidence');
  expect(()=>applyValidatedRewrites(extraction,{rewrites:[{path:'medications.0.dose',text:'80 mg'}]},[])).toThrow('existing prose');
 });
 it('still rejects invented quantities in simplified prose',()=>{const result=applyRewrites(extraction,{rewrites:[{path:'medications.0.plainLanguage',text:'Take 80 mg daily.'}]});expect(()=>validateClinical(result,[{sourceId,kind:'FINAL_AVS',text:quote,createdAt:new Date(),documentType:'text/plain',transcriptConfirmed:false}])).toThrow('unsupported');});
});
