import {z} from 'zod';
import {AppError} from '@/lib/security/core';
import {evidence,issue,generatedContent,type GeneratedContent,type SourceProvenance} from './contracts';
import {ClinicalValidationError} from './policy';
export const passageSections=['hospitalCourse','diagnoses','dailyActions','diet','fluids','activity','otherInstructions','appointments','labsAndMonitoring','teachBackQuestions','practicalBarriers'] as const;
const medicationFields=['dose','route','frequency','duration','formulation'] as const;
const medicationSelection=z.object({name:z.string().min(1),dose:z.string().nullable(),route:z.string().nullable(),frequency:z.string().nullable(),duration:z.string().nullable(),formulation:z.string().nullable(),status:z.enum(['NEW','CONTINUE','CHANGE','STOP','HOLD']),evidence}).strict();
export const extractionInputSchema=z.object({
 hospitalCourse:z.array(evidence),diagnoses:z.array(evidence),medications:z.array(medicationSelection),dailyActions:z.array(evidence),diet:z.array(evidence),fluids:z.array(evidence),activity:z.array(evidence),otherInstructions:z.array(evidence),appointments:z.array(evidence),labsAndMonitoring:z.array(evidence),warningSigns:z.array(z.object({level:z.enum(['CONTACT_CARE_TEAM','URGENT','EMERGENCY']),evidence}).strict()),teachBackQuestions:z.array(evidence),practicalBarriers:z.array(evidence),issues:z.array(issue)
}).strict();
// AI selects passages; only the server creates extracted prose from verified source text.
export function materializeExtraction(input:unknown,sources:SourceProvenance[]):GeneratedContent{
 const selected=extractionInputSchema.parse(input),refs=new Map(sources.map(s=>[s.sourceId,s.text]));
 function verified(ref:z.infer<typeof evidence>){if(!refs.get(ref.sourceId)?.includes(ref.quote))throw new AppError(422,'Extraction passage does not match its stored source.');return ref;}
 const content:GeneratedContent={language:'en',summary:null,hospitalCourse:[],diagnoses:[],medications:[],dailyActions:[],diet:[],fluids:[],activity:[],otherInstructions:[],appointments:[],labsAndMonitoring:[],warningSigns:[],definitions:[],teachBackQuestions:[],practicalBarriers:[],issues:selected.issues.map(i=>({...i,resolution:null}))};
 for(const section of passageSections)content[section]=selected[section].map(ref=>({text:verified(ref).quote,evidence:ref}));
 content.warningSigns=selected.warningSigns.map(item=>({text:verified(item.evidence).quote,...item}));
 content.medications=selected.medications.map((item,index)=>{
  const ref=verified(item.evidence);
  if(!ref.quote.toLowerCase().includes(item.name.toLowerCase()))throw new ClinicalValidationError(`Medication name must match its source: medications.${index}.name.`,JSON.stringify({field:`medications.${index}.name`,proposedName:item.name,citedQuote:ref.quote,correction:'Copy the exact medication name from this source passage.'}));
  const medication={...item,notes:ref.quote,plainLanguage:ref.quote};
  for(const field of medicationFields){const value=medication[field];if(value && !ref.quote.toLowerCase().includes(value.toLowerCase())){
   // Do not preserve an inferred/expanded clinical value. Keep the entire source
   // passage and make the unknown field an explicit approval-blocking discrepancy.
   medication[field]=null;
   content.issues.push({id:`unverified-medication-${index}-${field}`,severity:'critical',description:`Medication ${index+1}: ${field} could not be verified verbatim. Its structured value is null. Review the full medication source passage and enter the exact documented value; do not infer it.`,resolution:null});
  }}
  return medication;
 });
 return generatedContent.parse(content);
}
export function simplificationBase(extraction:GeneratedContent){
 const result=structuredClone(extraction);
 // No AI summary is requested during extraction. The first hospital-course passage
 // anchors an optional summary that can be generated only in stage two.
 if(!result.summary && result.hospitalCourse.length)result.summary=structuredClone(result.hospitalCourse[0]);
 return result;
}
