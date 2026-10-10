import {z} from 'zod';
import {AppError} from '@/lib/security/core';
import {ClinicalValidationError} from './policy';
import {generatedContent,type GeneratedContent} from './contracts';
export const rewriteSchema=z.object({rewrites:z.array(z.object({path:z.string(),text:z.string().min(1).max(4000)}).strict())}).strict();
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
