import { createHash } from 'node:crypto';
import { AppError,DAYS_30 } from '@/lib/security/core';
import type { GeneratedContent,SourceProvenance } from './contracts';
export function dischargeBoundary(value:string,timezone:string,now=new Date()) {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))throw new AppError(422,'Discharge requires an explicit time and UTC offset; a calendar date is insufficient.');
 try{new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format(now);}catch{throw new AppError(422,'Use a valid IANA discharge timezone.');}
 const dischargeAt=new Date(value);if(!Number.isFinite(dischargeAt.getTime()) || dischargeAt>now)throw new AppError(422,'Discharge time is invalid or in the future.');
 const calendar=value.slice(0,10),day=new Date(calendar+'T00:00:00Z');if(!Number.isFinite(day.getTime()) || day.toISOString().slice(0,10)!==calendar)throw new AppError(422,'Invalid discharge calendar date.');
 // Require the supplied offset to match the named zone at this instant, including DST.
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(dischargeAt);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));if(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`!==value.slice(0,16))throw new AppError(422,'Discharge timezone and timestamp offset do not match.');
 const expiresAt=new Date(dischargeAt.getTime()+DAYS_30);if(expiresAt<=now)throw new AppError(410,'Discharge episode has already expired.');return {dischargeAt,expiresAt};
}
export function activeEpisode(episode:{expiresAt:Date;state:string}){if(new Date(episode.expiresAt)<=new Date())throw new AppError(410,'Discharge record is unavailable.');if(['REVOKED','EXPIRED'].includes(episode.state))throw new AppError(403,'Discharge record is unavailable.');}
export function requireState(state:string,allowed:readonly string[]){if(!allowed.includes(state))throw new AppError(409,'Operation is not allowed in the current discharge state.');}
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v && typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
export function fingerprint(value:unknown){return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');}
export function extractionDateCandidates(text:string){return [...text.matchAll(/(?:discharge(?:d)?(?:\s+(?:date|at))?\s*[:=]\s*)(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2}))?)/gi)].map(m=>m[1]);}
export class ClinicalValidationError extends AppError {
 constructor(message:string,readonly retryFeedback:string){super(422,message);}
}
export function validateClinical(content:GeneratedContent,sources:SourceProvenance[]) {
 const refs=new Map(sources.map(s=>[s.sourceId,s]));
 const warnings:GeneratedContent['issues']=[];
 const sections=[...(content.summary?[content.summary]:[]),...content.hospitalCourse,...content.diagnoses,...content.dailyActions,...content.diet,...content.fluids,...content.activity,...content.otherInstructions,...content.appointments,...content.labsAndMonitoring,...content.warningSigns,...content.definitions,...content.teachBackQuestions,...content.practicalBarriers,...content.medications];
 const paths=content.summary?['summary']:[];
 for(const key of ['hospitalCourse','diagnoses','dailyActions','diet','fluids','activity','otherInstructions','appointments','labsAndMonitoring','warningSigns','definitions','teachBackQuestions','practicalBarriers','medications'] as const)content[key].forEach((_,index)=>paths.push(`${key}.${index}`));
 for(const [i,item] of sections.entries()){
  const source=refs.get(item.evidence.sourceId),quote=item.evidence.quote;
  if(!source || !source.text.includes(quote))throw new AppError(422,'Clinical evidence does not match the stored source.');
  if(source.kind==='AUDIO_TRANSCRIPT' && !source.transcriptConfirmed)throw new AppError(422,'Clinician must confirm the transcript before processing.');
  const text='text' in item?item.text:'meaning' in item?item.meaning:item.plainLanguage+' '+item.notes;
  // Compare whole quantity tokens, never substring matches (4 must not match 40).
  // Normalize typography only; do not convert units, doses or written numbers.
  const numbers=(v:string)=>v.match(/\d+(?:[.,/]\d+)*(?:\s*(?:mcg|mg|kg|mL|lb|units|grams?|liters?|g|L|%)(?![a-zA-Z]))?/gi) || [];
  const canonicalQuantity=(v:string)=>v.replace(/\s+/g,'').toLowerCase();
  const sourceNumbers=new Set(numbers(quote).map(canonicalQuantity));
  const generatedNumbers=new Set(numbers(text).map(canonicalQuantity));
  for(const n of numbers(text))if(!sourceNumbers.has(canonicalQuantity(n)))throw new ClinicalValidationError(`Generated quantities, units or dates are unsupported by their source at clinical item ${i} (${paths[i]}).`,JSON.stringify({clinicalItem:i,field:paths[i],instruction:text,unsupportedQuantity:n,citedQuote:quote,correction:'Use only quantities present in this exact cited quote. Choose the correct exact source quote for the instruction, or remove unsupported content. Do not invent or convert quantities.'}));
  for(const n of numbers(quote))if(!generatedNumbers.has(canonicalQuantity(n)))warnings.push({id:`quantity-${i}`,severity:'critical',description:'A cited source quantity or date is missing from the generated instruction.',resolution:null});
  const negation=/\b(?:not|never|avoid|stop|hold|unless|if|provided|until|pending|without)\b/gi;
  for(const token of quote.match(negation) || [])if(!new RegExp('\\b'+token+'\\b','i').test(text))warnings.push({id:`condition-${i}-${token.toLowerCase()}`,severity:'critical',description:'A negation or conditional qualifier from the source requires clinician reconciliation.',resolution:null});
 }
 const actions=[...content.dailyActions,...content.diet,...content.fluids,...content.activity,...content.otherInstructions,...content.appointments,...content.labsAndMonitoring,...content.warningSigns,...content.teachBackQuestions,...content.practicalBarriers];
 for(const action of actions)if(['CHART_CONTEXT','EPIC_FHIR'].includes(refs.get(action.evidence.sourceId)!.kind))throw new AppError(422,'Chart context cannot establish finalized discharge actions.');
 for(const [i,warning] of content.warningSigns.entries()){const levels:Record<string,RegExp>={CONTACT_CARE_TEAM:/contact|call|notify|care team/i,URGENT:/urgent|immediately|promptly/i,EMERGENCY:/emergency|911/i};if(!levels[warning.level].test(warning.evidence.quote))warnings.push({id:`escalation-${i}`,severity:'critical',description:'Escalation level is not explicit in the cited source; clinician must verify the intended action.',resolution:null});}
 for(const [i,m] of content.medications.entries()){
  const source=refs.get(m.evidence.sourceId)!;
  if(['CHART_CONTEXT','EPIC_FHIR'].includes(source.kind))throw new AppError(422,'Chart medications alone cannot establish discharge medication reconciliation.');
  for(const value of [m.name,m.dose,m.route,m.frequency,m.duration,m.formulation])if(value && !m.evidence.quote.toLowerCase().includes(value.toLowerCase()))throw new AppError(422,'Medication fields must appear verbatim in their cited source.');
  for(const form of m.evidence.quote.match(/\b(?:succinate|tartrate|ER|XR|XL|extended-release|delayed-release)\b/g) || [])if(!(m.name+' '+(m.formulation || '')).includes(form))warnings.push({id:`formulation-${i}`,severity:'critical',description:`${m.name}: preserve the source medication formulation.`,resolution:null});
  if(/\bfor\s+\d+\s+(?:days?|weeks?|months?)/i.test(m.evidence.quote) && !m.duration)warnings.push({id:`duration-${i}`,severity:'critical',description:`${m.name}: a source duration is missing from the medication field.`,resolution:null});
  const sourceLines=sources.filter(s=>!['CHART_CONTEXT','EPIC_FHIR'].includes(s.kind)).flatMap(s=>s.text.split(/\n/)).filter(line=>line.toLowerCase().includes(m.name.toLowerCase()));
  const directives=new Set(sourceLines.map(line=>line.match(/\b(?:STOP|HOLD|CONTINUE|NEW|CHANGE)\b/i)?.[0].toUpperCase()).filter(Boolean));
  const doses=new Set(sourceLines.flatMap(line=>line.match(/\d+(?:[./]\d+)?\s*(?:mg|mcg|mL|units)\b/gi) || []));
  if(directives.size>1 || doses.size>1)warnings.push({id:`source-conflict-${i}`,severity:'critical',description:`${m.name}: source lines contain different reconciliation directives or doses. Clinician must reconcile; no source may silently override another.`,resolution:null});
  const statusPattern:Record<string,RegExp>={NEW:/\bnew|start|initiat/i,CONTINUE:/\bcontinu/i,CHANGE:/\bchang|increas|decreas|replac/i,STOP:/\bstop|discontinu/i,HOLD:/\bhold|held|temporar/i};
  if(!statusPattern[m.status].test(m.evidence.quote))warnings.push({id:`status-${i}`,severity:'critical',description:`${m.name}: reconciliation status lacks explicit source evidence.`,resolution:null});
  if(!['STOP','HOLD'].includes(m.status) && (!m.dose || !m.route || !m.frequency))warnings.push({id:`medication-${i}`,severity:'critical',description:`${m.name}: missing dose, route or frequency. Do not guess.`,resolution:null});
 }
 return warnings;
}
export function approvalIssues(content:GeneratedContent){if(content.issues.some(i=>i.severity==='critical' && !i.resolution?.trim()))throw new AppError(422,'Resolve every critical discrepancy before approval.');}
