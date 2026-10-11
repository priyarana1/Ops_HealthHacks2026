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
// Typography-only normalization for comparing quotes: line breaks, curly quotes, dash styles and
// non-breaking spaces must not make an exact quote fail. Words, numbers and units are compared as written.
const squash=(v:string)=>v.normalize('NFKC').replace(/[\u2018\u2019\u201B\u2032]/g,"'").replace(/[\u201C\u201D\u2033]/g,'"').replace(/[\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();
// Discharge documents often state status as a heading ("New medications", "Stopped/held") above the item.
export function sectionHeading(text:string,quote:string){
 const at=text.indexOf(quote);if(at<0)return '';
 return text.slice(0,at).split('\n').slice(0,-1).reverse().map(l=>l.trim()).find(l=>l && l.length<=40 && !/^(?:[•▪◦·*-]|\d+[.)])\s/.test(l) && !/[.]$/.test(l)) || '';
}
const quantities=(v:string)=>v.match(/\d+(?:[.,/]\d+)*(?:\s*(?:mcg|mg|kg|mL|lb|units|grams?|liters?|g|L|%)(?![a-zA-Z]))?/gi) || [];
const quantityKey=(v:string)=>v.replace(/\s+/g,'').toLowerCase();
// Definitions and teach-back questions are optional extras. An unsupported number there should not
// force a full regeneration: drop the item and tell the clinician. Instruction sections stay strict.
export function pruneOptionalItems(content:GeneratedContent){
 let removed=0;
 const supported=(text:string,quote:string)=>{const allowed=new Set(quantities(quote).map(quantityKey));return quantities(text).every(n=>allowed.has(quantityKey(n)));};
 content.definitions=content.definitions.filter(d=>supported(d.meaning,d.evidence.quote) || (removed++,false));
 content.teachBackQuestions=content.teachBackQuestions.filter(q=>supported(q.text,q.evidence.quote) || (removed++,false));
 if(removed)content.issues.push({id:'optional-items-removed',severity:'warning',description:`${removed} AI-written definition or teach-back item(s) were removed because they contained numbers not found in the source.`,resolution:null});
 return content;
}
const TIMING_WORDS=/\b(morning|evening|night|nightly|bedtime|breakfast|lunch|dinner|meals?|food|empty stomach)\b/gi;
const NIGHT_TIMING=/\b(evening|night|nightly|bedtime)\b/i;
const PILL_COUNT=/\btake\s+(?:\d+|one|two|three|a|an|half(?: a)?)\s+(?:pill|tablet|capsule)s?\b/i;
export function validateClinical(content:GeneratedContent,sources:SourceProvenance[]) {
 const refs=new Map(sources.map(s=>[s.sourceId,s]));
 const warnings:GeneratedContent['issues']=[];
 const sections=[...(content.summary?[content.summary]:[]),...content.hospitalCourse,...content.diagnoses,...content.dailyActions,...content.diet,...content.fluids,...content.activity,...content.otherInstructions,...content.appointments,...content.labsAndMonitoring,...content.warningSigns,...content.definitions,...content.teachBackQuestions,...content.practicalBarriers,...content.medications];
 const paths=content.summary?['summary']:[];
 for(const key of ['hospitalCourse','diagnoses','dailyActions','diet','fluids','activity','otherInstructions','appointments','labsAndMonitoring','warningSigns','definitions','teachBackQuestions','practicalBarriers','medications'] as const)content[key].forEach((_,index)=>paths.push(`${key}.${index}`));
 for(const [i,item] of sections.entries()){
  const source=refs.get(item.evidence.sourceId),quote=item.evidence.quote;
  if(!source || !squash(source.text).includes(squash(quote)))throw new ClinicalValidationError(`Clinical evidence does not match the stored source (${paths[i]}).`,JSON.stringify({clinicalItem:i,field:paths[i],citedQuote:quote,correction:'Every evidence quote must be copied exactly from the source text, word for word.'}));
  if(source.kind==='AUDIO_TRANSCRIPT' && !source.transcriptConfirmed)throw new AppError(422,'Clinician must confirm the transcript before processing.');
  const text='text' in item?item.text:'meaning' in item?item.meaning:item.plainLanguage+' '+item.notes;
  // The patient also sees a medication's structured fields; those are verified verbatim separately below.
  const shown='plainLanguage' in item?[item.name,item.dose,item.route,item.frequency,item.duration,item.formulation,text].filter(Boolean).join(' '):text;
  // Omissions matter in instructions; background sections may summarize. Invented quantities are rejected everywhere.
  const instructional=!['summary','hospitalCourse','diagnoses','definitions','teachBackQuestions'].includes(paths[i].split('.')[0]);
  // Compare whole quantity tokens, never substring matches (4 must not match 40).
  // Normalize typography only; do not convert units, doses or written numbers.
  const numbers=quantities,canonicalQuantity=quantityKey;
  const sourceNumbers=new Set(numbers(quote).map(canonicalQuantity));
  const generatedNumbers=new Set(numbers(shown).map(canonicalQuantity));
  for(const n of numbers(text))if(!sourceNumbers.has(canonicalQuantity(n)))throw new ClinicalValidationError(`Generated quantities, units or dates are unsupported by their source at clinical item ${i} (${paths[i]}).`,JSON.stringify({clinicalItem:i,field:paths[i],instruction:text,unsupportedQuantity:n,citedQuote:quote,correction:'Use only quantities present in this exact cited quote. Choose the correct exact source quote for the instruction, or remove unsupported content. Do not invent or convert quantities.'}));
  if(instructional)for(const n of numbers(quote))if(!generatedNumbers.has(canonicalQuantity(n)) && !warnings.some(w=>w.id===`quantity-${i}`))warnings.push({id:`quantity-${i}`,severity:'critical',description:`${paths[i]}: the source says "${n}" but the patient text leaves it out. Source: "${quote}"`,resolution:null});
  const negation=/\b(?:not|never|avoid|stop|hold|unless|if|provided|until|pending|without)\b/gi;
  if(instructional)for(const token of quote.match(negation) || [])if(!new RegExp('\\b'+token+'\\b','i').test(text))warnings.push({id:`condition-${i}-${token.toLowerCase()}`,severity:'critical',description:`${paths[i]}: the source says "${token}" but the patient text leaves it out. Source: "${quote}"`,resolution:null});
  // Wording drift that changes an instruction. In simplification, a rewrite that adds one of these is rejected
  // and the source wording is kept. Sodium and salt are different amounts (2 g sodium is about 5 g salt).
  if(/\bsodium\b/i.test(quote) && !/\bsalt\b/i.test(quote) && /\bsalt\b/i.test(text))warnings.push({id:`sodium-as-salt-${i}`,severity:'critical',description:`${paths[i]}: the source says sodium, but the patient text says salt. These are different amounts. Source: "${quote}"`,resolution:null});
  if('plainLanguage' in item){
   const timing=[...new Set(text.match(TIMING_WORDS) || [])].filter(w=>!new RegExp(`\\b${w}`,'i').test(quote) && !(NIGHT_TIMING.test(w) && NIGHT_TIMING.test(quote)));
   if(timing.length)warnings.push({id:`added-timing-${i}`,severity:'critical',description:`${paths[i]}: the patient text adds "${timing.join('", "')}", but the source does not say when to take it. Source: "${quote}"`,resolution:null});
   const pills=text.match(PILL_COUNT)?.[0];
   if(pills && !quote.toLowerCase().includes(pills.toLowerCase()))warnings.push({id:`pill-count-${i}`,severity:'critical',description:`${paths[i]}: the patient text says "${pills}", but the source gives a strength, not a pill count. Source: "${quote}"`,resolution:null});
  }
 }
 const actions=[...content.dailyActions,...content.diet,...content.fluids,...content.activity,...content.otherInstructions,...content.appointments,...content.labsAndMonitoring,...content.warningSigns,...content.teachBackQuestions,...content.practicalBarriers];
 for(const action of actions)if(['CHART_CONTEXT','EPIC_FHIR'].includes(refs.get(action.evidence.sourceId)!.kind))throw new AppError(422,'Chart context cannot establish finalized discharge actions.');
 for(const [i,warning] of content.warningSigns.entries()){const levels:Record<string,RegExp>={CONTACT_CARE_TEAM:/contact|call|notify|care team/i,URGENT:/urgent|immediately|promptly/i,EMERGENCY:/emergency|911/i};const heading=sectionHeading(refs.get(warning.evidence.sourceId)?.text || '',warning.evidence.quote);if(!levels[warning.level].test(warning.evidence.quote+'\n'+heading))warnings.push({id:`escalation-${i}`,severity:'critical',description:`warningSigns.${i}: marked ${warning.level}, but the source does not say so. Source: "${warning.evidence.quote}"${heading?` under "${heading}"`:''}`,resolution:null});}
 for(const [i,m] of content.medications.entries()){
  const source=refs.get(m.evidence.sourceId)!;
  if(['CHART_CONTEXT','EPIC_FHIR'].includes(source.kind))throw new AppError(422,'Chart medications alone cannot establish discharge medication reconciliation.');
  for(const field of ['name','dose','route','frequency','duration','formulation'] as const){const value=m[field];if(value && !m.evidence.quote.toLowerCase().includes(value.toLowerCase()))throw new ClinicalValidationError(`Medication fields must appear verbatim in their cited source: medications.${i}.${field}.`,JSON.stringify({field:`medications.${i}.${field}`,proposedValue:value,citedQuote:m.evidence.quote,correction:'Copy the exact source substring. Do not expand abbreviations. For nullable fields use null if not stated, and add a critical missing-information flag. Never guess.'}));}
  for(const form of m.evidence.quote.match(/\b(?:succinate|tartrate|ER|XR|XL|extended-release|delayed-release)\b/g) || [])if(!(m.name+' '+(m.formulation || '')).includes(form))warnings.push({id:`formulation-${i}`,severity:'critical',description:`${m.name}: preserve the source medication formulation.`,resolution:null});
  if(/\bfor\s+\d+\s+(?:days?|weeks?|months?)/i.test(m.evidence.quote) && !m.duration)warnings.push({id:`duration-${i}`,severity:'critical',description:`${m.name}: a source duration is missing from the medication field.`,resolution:null});
  const sourceLines=sources.filter(s=>!['CHART_CONTEXT','EPIC_FHIR'].includes(s.kind)).flatMap(s=>s.text.split(/\n/)).filter(line=>line.toLowerCase().includes(m.name.toLowerCase()));
  const directives=new Set(sourceLines.map(line=>line.match(/\b(?:STOP|HOLD|CONTINUE|NEW|CHANGE)\b/i)?.[0].toUpperCase()).filter(Boolean));
  const doses=new Set(sourceLines.flatMap(line=>line.match(/\d+(?:[./]\d+)?\s*(?:mg|mcg|mL|units)\b/gi) || []));
  if(directives.size>1 || doses.size>1)warnings.push({id:`source-conflict-${i}`,severity:'critical',description:`${m.name}: source lines contain different reconciliation directives or doses. Clinician must reconcile; no source may silently override another.`,resolution:null});
  const statusPattern:Record<string,RegExp>={NEW:/\bnew|start|initiat/i,CONTINUE:/\bcontinu/i,CHANGE:/\bchang|increas|decreas|replac/i,STOP:/\bstop|discontinu/i,HOLD:/\bhold|held|temporar/i};
  if(!statusPattern[m.status].test(m.evidence.quote+'\n'+sectionHeading(source.text,m.evidence.quote)))warnings.push({id:`status-${i}`,severity:'critical',description:`${m.name}: reconciliation status lacks explicit source evidence.`,resolution:null});
  if(!['STOP','HOLD'].includes(m.status) && (!m.dose || !m.route || !m.frequency))warnings.push({id:`medication-${i}`,severity:m.dose && m.frequency?'warning':'critical',description:`${m.name}: the source does not state the ${(['dose','route','frequency'] as const).filter(k=>!m[k]).join(', ')}. Do not guess; confirm with the prescriber.`,resolution:null});
 }
 return warnings;
}
export function approvalIssues(content:GeneratedContent){if(content.issues.some(i=>i.severity==='critical' && !i.resolution?.trim()))throw new AppError(422,'Resolve every critical discrepancy before approval.');}
