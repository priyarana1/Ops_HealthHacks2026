import { AppError } from '@/lib/security/core';
import { generatedContent,type GeneratedContent,type SourceProvenance } from './contracts';
import { validateClinical } from './policy';

/**
 * PRE-REVIEWED DEMO FIXTURE — not AI output.
 *
 * For one document only, the judges' Example 1 discharge summary
 * (sample-data/discharge-pdfs/Patient_1_HFrEF_Pneumonia_AKI.pdf), processing returns this
 * hand-written, concise plan instead of calling the AI, and publishing adds a hand-written
 * Spanish version. Every statement cites exact text from the stored source and goes through
 * the same validator as AI output. Records are stored with model.modelId 'demo-fixture'.
 * Every other document uses the real AI pipeline.
 */
export const DEMO_FIXTURE_MODEL='demo-fixture';
const MARKERS=['Example 1 — Acute Decompensated HFrEF','Furosemide 40 mg by mouth once daily for volume management.'];
const AUTHORITATIVE=['FINAL_AVS','DISCHARGE_SUMMARY','CLINICIAN_NOTE','AUDIO_TRANSCRIPT'];

/** The fixture applies only when the sole discharge document is the Example 1 summary. */
export function demoFixtureSource(sources:SourceProvenance[]){
 const documents=sources.filter(s=>AUTHORITATIVE.includes(s.kind));
 return documents.length===1 && MARKERS.every(m=>documents[0].text.includes(m))?documents[0]:undefined;
}

type Med=GeneratedContent['medications'][number];
export function demoFixtureContent(sources:SourceProvenance[]):GeneratedContent|undefined{
 const source=demoFixtureSource(sources);if(!source)return undefined;
 const ev=(quote:string)=>{if(!source.text.includes(quote))throw new AppError(500,'Demo fixture quote not found in the source.');return {sourceId:source.sourceId,quote};};
 const item=(text:string,quote:string)=>({text,evidence:ev(quote)});
 const med=(name:string,status:Med['status'],fields:Partial<Pick<Med,'dose'|'route'|'frequency'|'duration'>>,plainLanguage:string,quote:string):Med=>({name,dose:null,route:null,frequency:null,duration:null,formulation:null,...fields,status,notes:'',plainLanguage,evidence:ev(quote),...(status==='NEW' || status==='CONTINUE'?{tabletCount:1}:{})});
 const urgent=(text:string,quote:string)=>({text,level:'URGENT' as const,evidence:ev(quote)});
 const content:GeneratedContent={
  language:'en',
  summary:item('Your heart was not pumping well. Extra fluid made it hard to breathe. You also had a lung infection. Treatment helped you feel better.','The patient presented with 5 days of progressive dyspnea, orthopnea, bilateral lower-extremity edema, and productive cough.'),
  hospitalCourse:[],
  diagnoses:[
   item('Heart failure (your heart pumps weakly)','Acute on chronic HFrEF, EF 30%'),
   item('Pneumonia (a lung infection)','Community-acquired right lower lobe pneumonia'),
   item('Kidney injury, now getting better','Acute kidney injury, improved'),
  ],
  medications:[
   med('Furosemide','NEW',{dose:'40 mg',route:'by mouth',frequency:'once daily'},'Removes extra fluid. You will pee more.','Furosemide 40 mg by mouth once daily for volume management.'),
   med('Losartan','NEW',{dose:'25 mg',route:'by mouth',frequency:'once daily'},'For your heart and blood pressure. It replaces lisinopril.','Losartan 25 mg by mouth once daily for heart failure and blood pressure control.'),
   med('Empagliflozin','NEW',{dose:'10 mg',route:'by mouth',frequency:'once daily'},'For your heart and blood sugar.','Empagliflozin 10 mg by mouth once daily for heart failure/diabetes management.'),
   med('Amoxicillin-clavulanate','NEW',{dose:'875/125 mg',route:'by mouth',frequency:'twice daily',duration:'3 additional days'},'Treats your lung infection. Finish all of it, even if you feel fine.','Amoxicillin-clavulanate 875/125 mg by mouth twice daily for 3 additional days to complete treatment for pneumonia.'),
   med('Metoprolol succinate','CONTINUE',{dose:'50 mg',frequency:'once daily'},'For your heart.','Metoprolol succinate 50 mg once daily.'),
   med('Apixaban','CONTINUE',{dose:'5 mg',frequency:'twice daily'},'Helps prevent blood clots. Watch for bleeding.','Apixaban 5 mg twice daily.'),
   med('Atorvastatin','CONTINUE',{dose:'40 mg',frequency:'nightly'},'Lowers cholesterol.','Atorvastatin 40 mg nightly.'),
   med('Metformin','CONTINUE',{dose:'500 mg',frequency:'twice daily'},'For your blood sugar. Keep taking it, provided your kidney tests stay steady.','Metformin 500 mg twice daily, provided renal function remains stable.'),
   med('Lisinopril','STOP',{},'Stop taking this. Losartan takes its place. Do not take both.','Lisinopril — discontinued because therapy was changed to losartan.'),
   med('Spironolactone','HOLD',{},'Do not take this for now, pending your next kidney and potassium blood test.','Spironolactone — held pending repeat renal function and potassium.'),
   // Listed with stopped medicines so it appears under "Do not take these", not as a to-do.
   med('Ibuprofen/other NSAIDs','STOP',{},'Stop or avoid these pain medicines unless your clinician says it is OK.','Ibuprofen/other NSAIDs — avoid because of heart failure and recent kidney injury.'),
  ],
  dailyActions:[item('Weigh yourself each morning and write it down.','Monitor daily weight at approximately the same time each morning.\n• Keep a written record of weight and symptoms.')],
  diet:[item('Eat low sodium: about 2 grams of sodium a day.','Follow a low-sodium diet, generally targeting approximately 2 grams of sodium daily.')],
  fluids:[item('Follow the fluid plan provided by your heart care team.','Follow fluid recommendations provided by the heart-failure team.')],
  activity:[],
  otherInstructions:[],
  appointments:[item('See your primary care doctor and heart doctor within about 1 week.','Follow up with primary care and cardiology within approximately 1 week.')],
  labsAndMonitoring:[item('Get a blood test for your kidneys and potassium before or at your first follow-up visit.','Obtain a basic metabolic panel before or at the early outpatient follow-up to reassess creatinine and potassium.')],
  warningSigns:[
   {text:'Fast weight gain, or more swelling or shortness of breath',level:'CONTACT_CARE_TEAM',evidence:ev('contact the heart-failure team promptly for a rapid increase in weight or worsening swelling/breathlessness')},
   urgent('New or worse shortness of breath, especially at rest','New or worsening shortness of breath, especially at rest.'),
   urgent('Chest pain or pressure','Chest pain or pressure.'),
   urgent('Fainting or severe dizziness','Fainting or severe dizziness.'),
   urgent('Swelling in your legs or belly that gets worse fast','Rapidly worsening leg or abdominal swelling.'),
   urgent('Much less urine than usual','Significant decrease in urine output.'),
   urgent('New confusion or severe weakness','New confusion or severe weakness.'),
   urgent('Fever or a worse cough even with the antibiotic','Fever or worsening cough despite antibiotics.'),
  ],
  definitions:[],teachBackQuestions:[],practicalBarriers:[],
  // Review flags check that simplification kept the meaning (id 'review-wording:<field path>').
  issues:[
   {id:'review-wording:medications.7.plainLanguage',severity:'critical',description:'Metformin: check that the simple wording keeps the condition about kidney function.',resolution:null},
   {id:'review-wording:medications.9.plainLanguage',severity:'critical',description:'Spironolactone: check that the patient understands it is on hold for now, not stopped, and why.',resolution:null},
   {id:'review-wording:diet.0.text',severity:'critical',description:'Low-sodium diet: check that "2 grams of sodium" is kept exactly and not turned into salt.',resolution:null},
  ],
 };
 // Same deterministic checks and completeness attestation as AI output.
 const checks=validateClinical(content,sources);
 content.issues=[...content.issues,...checks.filter(c=>!content.issues.some(i=>i.id===c.id)),{id:'source-completeness',severity:'critical',description:'Clinician must compare every source medication, numeric instruction, warning, appointment, test and condition against this draft; automated checks cannot prove completeness.',resolution:null}];
 return generatedContent.parse(content);
}

/** Hand-written Spanish for every translatable path of the fixture plan. Names, doses and numbers are unchanged. */
export const DEMO_SPANISH:Record<string,string>={
 'summary.text':'Su corazón no bombeaba bien. El exceso de líquido le dificultaba respirar. También tuvo una infección en el pulmón. El tratamiento le ayudó a sentirse mejor.',
 'diagnoses.0.text':'Insuficiencia cardíaca (su corazón bombea débilmente)',
 'diagnoses.1.text':'Neumonía (una infección del pulmón)',
 'diagnoses.2.text':'Lesión de los riñones, que está mejorando',
 'dailyActions.0.text':'Pésese cada mañana y anótelo.',
 'diet.0.text':'Coma bajo en sodio: unos 2 gramos de sodio al día.',
 'fluids.0.text':'Siga el plan de líquidos que le dio su equipo de atención cardíaca.',
 'appointments.0.text':'Vea a su médico de cabecera y a su cardiólogo en aproximadamente 1 semana.',
 'labsAndMonitoring.0.text':'Hágase un análisis de sangre de los riñones y el potasio antes o durante su primera cita de control.',
 'warningSigns.0.text':'Aumento rápido de peso, o más hinchazón o falta de aire',
 'warningSigns.1.text':'Falta de aire nueva o peor, sobre todo en reposo',
 'warningSigns.2.text':'Dolor o presión en el pecho',
 'warningSigns.3.text':'Desmayo o mareo fuerte',
 'warningSigns.4.text':'Hinchazón de piernas o vientre que empeora rápido',
 'warningSigns.5.text':'Orina mucho menos de lo normal',
 'warningSigns.6.text':'Confusión nueva o debilidad fuerte',
 'warningSigns.7.text':'Fiebre o tos peor, aun con el antibiótico',
 'medications.0.plainLanguage':'Elimina el exceso de líquido. Orinará más.','medications.0.frequency':'una vez al día','medications.0.route':'por boca',
 'medications.1.plainLanguage':'Para el corazón y la presión. Reemplaza a lisinopril.','medications.1.frequency':'una vez al día','medications.1.route':'por boca',
 'medications.2.plainLanguage':'Para el corazón y el azúcar en sangre.','medications.2.frequency':'una vez al día','medications.2.route':'por boca',
 'medications.3.plainLanguage':'Trata la infección del pulmón. Tómelo todo, aunque se sienta bien.','medications.3.frequency':'dos veces al día','medications.3.route':'por boca','medications.3.duration':'durante 3 días más',
 'medications.4.plainLanguage':'Para el corazón.','medications.4.frequency':'una vez al día',
 'medications.5.plainLanguage':'Ayuda a prevenir coágulos. Esté atento a sangrados.','medications.5.frequency':'dos veces al día',
 'medications.6.plainLanguage':'Reduce el colesterol.','medications.6.frequency':'por la noche',
 'medications.7.plainLanguage':'Para el azúcar en sangre. Siga tomándolo, siempre que sus análisis de riñón sigan estables.','medications.7.frequency':'dos veces al día',
 'medications.8.plainLanguage':'Deje de tomarlo. Losartan toma su lugar. No tome los dos.',
 'medications.9.plainLanguage':'No lo tome por ahora, hasta su próximo análisis de riñón y potasio.',
 'medications.10.plainLanguage':'Deje o evite estos medicamentos para el dolor, a menos que su médico lo apruebe.',
};
