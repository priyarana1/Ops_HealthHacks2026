import {z} from 'zod';
import {AppError} from '@/lib/security/core';
import {ClinicalValidationError,validateClinical} from './policy';
import {generatedContent,type GeneratedContent,type SourceProvenance} from './contracts';
export const rewriteSchema=z.object({rewrites:z.array(z.object({path:z.string(),text:z.string().min(1).max(4000)}).strict()),flags:z.array(z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),severity:z.enum(['critical','warning']),description:z.string().min(1).max(4000)}).strict()).optional()}).strict();
// Only prose can be rewritten. Clinical values, status, evidence, and issue resolution
// are never accepted from the simplifier, even if the model returns them.
export function proseFields(content:GeneratedContent){
 const fields:{path:string;text:string}[]=[];
 if(content.summary)fields.push({path:'summary.text',text:content.summary.text});
 for(const section of ['hospitalCourse','diagnoses','dailyActions','diet','fluids','activity','otherInstructions','appointments','labsAndMonitoring','warningSigns','teachBackQuestions','practicalBarriers'] as const)content[section].forEach((item,index)=>fields.push({path:`${section}.${index}.text`,text:item.text}));
 content.medications.forEach((item,index)=>fields.push({path:`medications.${index}.plainLanguage`,text:item.plainLanguage}));
 content.definitions.forEach((item,index)=>fields.push({path:`definitions.${index}.meaning`,text:item.meaning}));
 return fields;
}
export function applyRewrites(extraction:GeneratedContent,input:unknown){
 const parsed=rewriteSchema.parse(input),allowed=new Set(proseFields(extraction).map(f=>f.path)),seen=new Set<string>();
 const result=structuredClone(extraction);
 for(const rewrite of parsed.rewrites){
  if(!allowed.has(rewrite.path) || seen.has(rewrite.path))throw new AppError(422,'Simplification may update existing prose fields only, once per field.');
  seen.add(rewrite.path);
  const keys=rewrite.path.split('.');let object:Record<string,unknown>=result as unknown as Record<string,unknown>;
  for(const key of keys.slice(0,-1))object=object[key] as Record<string,unknown>;
  object[keys.at(-1)!]=rewrite.text;
 }
 for(const flag of parsed.flags || []){const id='simplification-'+flag.id;if(result.issues.some(i=>i.id===id))throw new AppError(422,'Simplification flags must have unique IDs.');result.issues.push({...flag,id,resolution:null});}
 return generatedContent.parse(result);
}
export function requireVerbatimExtraction(content:GeneratedContent){
 for(const field of proseFields(content)){
  const keys=field.path.split('.');let item:unknown=content;
  for(const key of keys.slice(0,-1))item=(item as Record<string,unknown>)[key];
  const quote=(item as {evidence:{quote:string}}).evidence.quote;
  if(field.text!==quote)throw new ClinicalValidationError(`Extraction prose must copy its source quote exactly before simplification: ${field.path}.`,JSON.stringify({field:field.path,proposedText:field.text,requiredText:quote,correction:'Replace the prose with requiredText exactly. Simplification happens in a separate stage.'}));
 }
}

// Retain a source-faithful draft when a particular paraphrase is unsafe. This is
// explicitly flagged for review, never treated as a clinically verified AI result.
export function applyValidatedRewrites(extraction:GeneratedContent,input:unknown,sources:SourceProvenance[]){
 const parsed=rewriteSchema.parse(input);
 // Validate all paths/duplicates/flags before considering any partial acceptance.
 applyRewrites(extraction,parsed);
 const baseline=new Set(validateClinical(extraction,sources).filter(i=>i.severity==='critical').map(i=>i.id));
 let content=applyRewrites(extraction,{rewrites:[],flags:parsed.flags});
 const rejectedPaths:string[]=[];
 for(const rewrite of parsed.rewrites){
  const candidate=applyRewrites(content,{rewrites:[rewrite]});
  let reason:string|undefined;
  try{
   const checks=validateClinical(candidate,sources);
   if(checks.some(i=>i.severity==='critical'&&!baseline.has(i.id)))reason='The shortened wording lost a source quantity or conditional instruction.';
  }catch(error){
   if(!(error instanceof ClinicalValidationError))throw error;
   reason='The shortened wording introduced a clinical value unsupported by its cited source.';
  }
  if(reason){
   rejectedPaths.push(rewrite.path);
   content.issues.push({id:'source-wording-retained-'+rewrite.path.replaceAll('.','-'),severity:'critical',description:`${rewrite.path}: ${reason} That rewrite was rejected and the original source wording was retained. Review this field before approval.`,resolution:null});
  }else content=candidate;
 }
 const checks=validateClinical(content,sources);
 content.issues=[...content.issues.filter(i=>!checks.some(c=>c.id===i.id)),...checks];
 return {content,rejectedPaths};
}
