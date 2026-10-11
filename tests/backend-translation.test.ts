import { describe,it,expect } from 'vitest';
import { lineProblems,translatableFields,applyTranslation } from '../src/lib/backend/translation';
import type { GeneratedContent } from '../src/lib/backend/contracts';

const ev={sourceId:'12345678-1234-4234-8234-123456789012',quote:'q'};
const content:GeneratedContent={language:'en',summary:{text:'You had heart failure.',evidence:ev},hospitalCourse:[],diagnoses:[],
 medications:[{name:'Furosemide',dose:'40 mg',route:'by mouth',frequency:'once daily',duration:null,formulation:null,status:'NEW',notes:'',plainLanguage:'A water pill. Take 40 mg once daily.',evidence:ev}],
 dailyActions:[{text:'Weigh yourself each morning.',evidence:ev}],diet:[],fluids:[],activity:[],otherInstructions:[],appointments:[],labsAndMonitoring:[],
 warningSigns:[{text:'Call 911 for chest pain.',level:'EMERGENCY',evidence:ev}],definitions:[],teachBackQuestions:[],practicalBarriers:[],issues:[]};

describe('Translation line checks',()=>{
 it('passes a faithful translation',()=>expect(lineProblems('Take 40 mg once daily. Do not take ibuprofen.','Tome 40 mg una vez al día. No tome ibuprofeno.','Take 40 mg once a day. Do not take ibuprofen.',['Furosemide'])).toEqual([]));
 it('flags a changed or added number',()=>{expect(lineProblems('Take 40 mg once daily.','Tome 20 mg una vez al día.',undefined,[])[0]).toMatch(/missing or changed 40 mg/);expect(lineProblems('Weigh yourself.','Pésese 2 veces.',undefined,[])[0]).toMatch(/adds 2/);});
 it('flags a medicine name that was translated or dropped',()=>expect(lineProblems('Take Furosemide 40 mg.','Tome furosemida 40 mg.',undefined,['Furosemide'])).toEqual(['The medicine name Furosemide must appear unchanged.']));
 it('flags a back-translation that lost "do not" or a condition',()=>{
  expect(lineProblems('Do not take both.','Tome los dos.','Take both.',[])).toEqual(['The back-translation lost a "do not" instruction.']);
  expect(lineProblems('Take metformin only if your kidneys stay stable.','Tome metformina.','Take metformin.',[])).toContain('The back-translation lost a condition ("only if", "unless", "until").');
 });
});

describe('Translatable fields',()=>{
 const fields=translatableFields(content);
 it('lists patient-facing prose and medicine timing, never medicine names or doses',()=>{
  expect(fields.map(f=>f.path)).toEqual(['summary.text','dailyActions.0.text','warningSigns.0.text','medications.0.plainLanguage','medications.0.frequency','medications.0.route']);
  expect(fields.some(f=>f.text==='Furosemide' || f.text==='40 mg')).toBe(false);
 });
 it('applies translations by path and keeps names and doses',()=>{
  const es=applyTranslation(content,[{path:'medications.0.frequency',text:'una vez al día'},{path:'summary.text',text:'Tuvo insuficiencia cardíaca.'}]);
  expect(es.medications[0]).toMatchObject({name:'Furosemide',dose:'40 mg',frequency:'una vez al día'});expect(es.summary!.text).toBe('Tuvo insuficiencia cardíaca.');
  expect(content.summary!.text).toBe('You had heart failure.');
 });
});
describe('Unit words versus abbreviations',()=>{
 it('allows a translated unit word but not a changed number or abbreviation',()=>{
  expect(lineProblems('Eat about 2 grams of sodium a day.','Coma unos 2 gramos de sodio al día.',undefined,[])).toEqual([]);
  expect(lineProblems('Eat about 2 grams of sodium a day.','Coma unos 3 gramos de sodio al día.',undefined,[])[0]).toMatch(/missing or changed 2 grams/);
  expect(lineProblems('Take 40 mg.','Tome 40 miligramos.',undefined,[])[0]).toMatch(/missing or changed 40 mg/);
 });
});
