import { randomUUID,randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { AppError,hash,randomToken } from '@/lib/security/core';
import { records,fhirId } from '@/lib/epic/resources';
import { createEpisode,sourceInput,reviewInput,approveInput,grantInput,generatedContent,type SourceProvenance } from './contracts';
import { EpisodeModel,PatientReferenceModel,ClinicalPlanModel,SourceModel,ApprovalModel,InvitationModel,AccountModel,PatientSessionModel,ObjectManifestModel } from './models';
import { transaction,ownedEpisode,snapshot,signedContent } from './repository';
import { dischargeBoundary,extractionDateCandidates,requireState,fingerprint,validateClinical,approvalIssues } from './policy';
import { clinicalProcessor } from './bedrock';
import { emailDelivery } from './email';
import { putAudio } from '@/lib/aws/s3';
import { extractDocument,MAX_DOCUMENT_BYTES } from './documents';
const editable=['DRAFT','PENDING_REVIEW','APPROVED','ACCESS_GRANTED','ACTIVE','REVOKED'];
function duplicate(error:unknown){return error && typeof error==='object' && 'code' in error && error.code===11000;}
export async function createDischarge(owner:string,sessionId:string,body:unknown){
 const data=createEpisode.parse(body);if(data.clinicalInput && data.sourceKind==='EPIC_FHIR')throw new AppError(422,'Manual text cannot claim Epic provenance.');const boundary=dischargeBoundary(data.dischargeAt,data.dischargeTimezone),requestFingerprint=fingerprint(data);
 const existing=await ownedRequest(owner,data.requestId,requestFingerprint);if(existing)return existing;
 const chart=data.epicPatientId?await records(sessionId,fhirId(data.epicPatientId)):undefined;
 if(data.encounterId && !chart?.results.find(r=>r.resourceType==='Encounter')?.resources.some(r=>r.id===data.encounterId))throw new AppError(422,'Encounter must belong to the authorized imported patient.');
 const episodeId=randomUUID(),patientId=randomUUID(),planId=randomUUID(),createdAt=new Date();
 try{return await transaction(async session=>{
  await EpisodeModel.create([{episodeId,patientId,planId,owner,requestId:data.requestId,requestFingerprint,synthetic:true,state:'DRAFT',version:1,...boundary,dischargeTimezone:data.dischargeTimezone,dischargeConfirmed:data.dischargeConfirmed,createdAt,epic:chart?{issuer:chart.issuer,patientId:chart.patientId,encounterId:data.encounterId}:undefined}],{session});
  await PatientReferenceModel.create([{episodeId,patientId,owner,...data.patient,expiresAt:boundary.expiresAt}],{session});
  await ClinicalPlanModel.create([{episodeId,patientId,planId,version:1,expiresAt:boundary.expiresAt}],{session});
  const sources:SourceProvenance[]=[];
  if(data.clinicalInput?.trim())sources.push({sourceId:randomUUID(),kind:data.sourceKind,text:data.clinicalInput,createdAt,documentType:'text/plain',transcriptConfirmed:false});
  if(chart)sources.push({sourceId:randomUUID(),kind:'EPIC_FHIR',text:JSON.stringify(chart),createdAt,documentType:'application/fhir+json',transcriptConfirmed:false});
  for(const source of sources)await SourceModel.create([{...source,episodeId,expiresAt:boundary.expiresAt,requestId:source.sourceId,requestFingerprint:fingerprint(source.text),dateCandidates:extractionDateCandidates(source.text)}],{session});
  return {episodeId,patientId,planId,state:'DRAFT',version:1,...boundary};
 });}catch(e){if(duplicate(e)){const prior=await ownedRequest(owner,data.requestId,requestFingerprint);if(prior)return prior;}throw e;}
}
async function ownedRequest(owner:string,requestId:string,expected:string){
 const {connectDB}=await import('@/lib/db/mongodb');await connectDB();const previous=await EpisodeModel.findOne({owner,requestId});if(!previous)return null;if(previous.requestFingerprint!==expected)throw new AppError(409,'Request ID was already used with different data.');if(previous.expiresAt<=new Date())throw new AppError(410,'Discharge episode expired.');return {episodeId:previous.episodeId,patientId:previous.patientId,planId:previous.planId,state:previous.state,version:previous.version,dischargeAt:previous.dischargeAt,expiresAt:previous.expiresAt};
}
async function invalidate(episodeId:string,session:import('mongoose').ClientSession){
 await ApprovalModel.updateMany({episodeId,invalidatedAt:{$exists:false}},{$set:{invalidatedAt:new Date()}},{session});
 await InvitationModel.updateMany({episodeId,state:{$in:['SENT','PENDING_DELIVERY']}},{$set:{state:'REVOKED'}},{session});
 await AccountModel.updateMany({episodeId},{$set:{state:'REVOKED'}},{session});await PatientSessionModel.deleteMany({episodeId},{session});
}
export async function addSource(planId:string,owner:string,body:unknown,file?:File){
 const data=sourceInput.parse(body),episode=await ownedEpisode(planId,owner,true);requireState(episode.state,editable);
 const fileBytes=file?Buffer.from(await file.arrayBuffer()):undefined;
 const requestFingerprint=fingerprint({kind:data.kind,text:data.text,transcriptConfirmed:data.transcriptConfirmed,file:fileBytes?{contentHash:fingerprint(fileBytes.toString('base64')),type:file!.type}:undefined});
 const previous=await SourceModel.findOne({episodeId:episode.episodeId,requestId:data.requestId});if(previous){if(previous.requestFingerprint!==requestFingerprint)throw new AppError(409,'Source request ID was reused with different data.');return {sourceId:previous.sourceId,version:episode.version};}
 if(data.kind==='EPIC_FHIR')throw new AppError(422,'Epic provenance can only be created by the authorized Epic import adapter.');
 const extracted=file?await extractDocument(file.name,file.type,fileBytes!):{text:data.text,documentType:'text/plain'};
 const sourceId=randomUUID(),createdAt=new Date();let key:string|undefined;
 if(file && process.env.AWS_S3_BUCKET){key=`clinical/${randomUUID()}`;await ObjectManifestModel.create({episodeId:episode.episodeId,objectId:randomUUID(),key,expiresAt:episode.expiresAt,state:'PENDING_UPLOAD',attempts:0});try{await putAudio(key,fileBytes!,extracted.documentType);await ObjectManifestModel.updateOne({key},{$set:{state:'STORED'}});}catch{await ObjectManifestModel.updateOne({key},{$set:{state:'CLEANUP_PENDING'}});throw new AppError(503,'Private source upload failed. Source was not saved.');}}
 try{return await transaction(async session=>{
  const claimed=await EpisodeModel.findOneAndUpdate({_id:episode._id,version:episode.version,state:{$in:editable},expiresAt:{$gt:new Date()}},{$set:{state:'DRAFT'},$unset:{approval:1,grantVersion:1,grantInvitationId:1},$inc:{version:1}},{session,new:true});if(!claimed)throw new AppError(409,'Discharge changed. Reload and retry.');
  await invalidate(episode.episodeId,session);
  await SourceModel.create([{sourceId,episodeId:episode.episodeId,requestId:data.requestId,requestFingerprint,kind:data.kind,text:extracted.text,createdAt,documentType:extracted.documentType,transcriptConfirmed:data.transcriptConfirmed,expiresAt:episode.expiresAt,dateCandidates:extractionDateCandidates(extracted.text),objectKey:key}],{session});
  await ClinicalPlanModel.updateOne({episodeId:episode.episodeId},{$set:{version:claimed.version},$unset:{content:1,extraction:1,extractionModel:1,model:1,sourceFingerprint:1}},{session});return {sourceId,version:claimed.version,documentType:extracted.documentType,originalStored:!!key};
 });}catch(e){if(key)await ObjectManifestModel.updateOne({key},{$set:{state:'CLEANUP_PENDING'}});if(duplicate(e)){const prior=await SourceModel.findOne({episodeId:episode.episodeId,requestId:data.requestId});if(prior?.requestFingerprint===requestFingerprint)return {sourceId:prior.sourceId};}throw e;}
}
export async function processDischarge(planId:string,owner:string){
 const episode=await ownedEpisode(planId,owner);requireState(episode.state,['DRAFT','PENDING_REVIEW']);
 const sources=await SourceModel.find({episodeId:episode.episodeId}).sort({sourceId:1}).lean();
 if(!sources.some(s=>['FINAL_AVS','DISCHARGE_SUMMARY','CLINICIAN_NOTE'].includes(s.kind) || (s.kind==='AUDIO_TRANSCRIPT' && s.transcriptConfirmed)))throw new AppError(422,'Provide finalized discharge instructions or confirmed clinician dictation; chart context alone is insufficient.');
 if(sources.some(s=>s.kind==='AUDIO_TRANSCRIPT' && !s.transcriptConfirmed))throw new AppError(422,'Confirm or remove all supplemental transcripts first.');
 const claimed=await EpisodeModel.findOneAndUpdate({_id:episode._id,version:episode.version,state:episode.state,expiresAt:{$gt:new Date()}},{$set:{state:'PROCESSING',processingStartedAt:new Date()}},{new:true});if(!claimed)throw new AppError(409,'Discharge changed. Retry after reloading.');
 try{
  const generated=await clinicalProcessor.process(sources,async(extraction,extractionModel)=>{
   await transaction(async session=>{
    const current=await EpisodeModel.findOneAndUpdate({_id:claimed._id,version:claimed.version,state:'PROCESSING',expiresAt:{$gt:new Date()}},{$set:{processingStartedAt:new Date()}},{session,new:true});if(!current)throw new AppError(409,'Discharge changed during extraction.');
    const saved=await ClinicalPlanModel.updateOne({episodeId:episode.episodeId,version:claimed.version,expiresAt:{$gt:new Date()}},{$set:{extraction,extractionModel}},{session});if(!(saved.matchedCount ?? saved.modifiedCount))throw new AppError(409,'Discharge plan changed during extraction.');
   });
  });const localDate=new Intl.DateTimeFormat('en-CA',{timeZone:episode.dischargeTimezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(episode.dischargeAt);if(sources.some(s=>s.dateCandidates.some(candidate=>candidate.slice(0,10)!==localDate)))generated.content.issues.push({id:'discharge-date-conflict',severity:'critical',description:'A source discharge-date candidate differs from the episode discharge date. Clinician must reconcile before approval.',resolution:null});const sourceFingerprint=fingerprint(sources.map(s=>({sourceId:s.sourceId,text:s.text,kind:s.kind,transcriptConfirmed:s.transcriptConfirmed})));
  await transaction(async session=>{
   const saved=await EpisodeModel.findOneAndUpdate({_id:claimed._id,version:claimed.version,state:'PROCESSING',expiresAt:{$gt:new Date()}},{$set:{state:'PENDING_REVIEW'},$unset:{approval:1,grantVersion:1,processingStartedAt:1},$inc:{version:1}},{session,new:true});if(!saved)throw new AppError(409,'Processing lease expired or discharge changed.');
   await invalidate(episode.episodeId,session);await ClinicalPlanModel.updateOne({episodeId:episode.episodeId},{$set:{...generated,sourceFingerprint,version:saved.version}},{session});
  });return snapshot(planId,owner);
 }catch(e){await EpisodeModel.updateOne({_id:claimed._id,version:claimed.version,state:'PROCESSING'},{$set:{state:episode.state},$unset:{processingStartedAt:1}});throw e;}
}
export async function reviewDischarge(planId:string,owner:string,body:unknown){
 const data=reviewInput.parse(body),episode=await ownedEpisode(planId,owner,true);requireState(episode.state,editable);
 const plan=await ClinicalPlanModel.findOne({episodeId:episode.episodeId}),sources=await SourceModel.find({episodeId:episode.episodeId}).lean();
 let content=data.content || plan?.content;if(content){content=generatedContent.parse(content);const checks=validateClinical(content,sources);for(const check of checks)if(!content.issues.some(i=>i.id===check.id))content.issues.push(check);for(const resolution of data.resolutions || []){const item=content.issues.find(i=>i.id===resolution.id);if(!item)throw new AppError(422,'Unknown discrepancy ID.');item.resolution=resolution.resolution;}}
 await transaction(async session=>{
  const saved=await EpisodeModel.findOneAndUpdate({_id:episode._id,version:data.version,state:{$in:editable},expiresAt:{$gt:new Date()}},{$set:{state:content?'PENDING_REVIEW':'DRAFT',dischargeConfirmed:data.dischargeConfirmed ?? episode.dischargeConfirmed},$unset:{approval:1,grantVersion:1,grantInvitationId:1},$inc:{version:1}},{session,new:true});if(!saved)throw new AppError(409,'Version conflict. Reload before editing.');await invalidate(episode.episodeId,session);await ClinicalPlanModel.updateOne({episodeId:episode.episodeId},{$set:{content,version:saved.version}},{session});
 });return snapshot(planId,owner);
}
export async function approveDischarge(planId:string,owner:string,body:unknown){
 const data=approveInput.parse(body),episode=await ownedEpisode(planId,owner);requireState(episode.state,['PENDING_REVIEW']);
 dischargeBoundary(episode.dischargeAt.toISOString(),'UTC');if(!episode.dischargeConfirmed)throw new AppError(422,'Confirm the discharge date, time and timezone before approval.');
 const plan=await ClinicalPlanModel.findOne({episodeId:episode.episodeId});if(!plan?.content || !plan.model)throw new AppError(409,'Generate and review clinical output before approval.');
 const content=generatedContent.parse(plan.content),sources=await SourceModel.find({episodeId:episode.episodeId}).lean();const checks=validateClinical(content,sources);for(const check of checks)if(check.severity==='critical' && !content.issues.some(i=>i.id===check.id && i.resolution?.trim()))throw new AppError(422,'Resolve deterministic clinical discrepancies before approval.');approvalIssues(content);if(!content.issues.some(i=>i.id==='source-completeness' && i.resolution?.trim()))throw new AppError(422,'Explicit source-completeness review is required.');
 const integrity=fingerprint({content,dischargeAt:episode.dischargeAt.toISOString(),sourceFingerprint:plan.sourceFingerprint}),approvedAt=new Date();
 await transaction(async session=>{
  const result=await EpisodeModel.updateOne({_id:episode._id,version:data.version,state:'PENDING_REVIEW',expiresAt:{$gt:new Date()}},{$set:{state:'APPROVED',approval:{providerId:owner,approvedAt,version:data.version,fingerprint:integrity}}},{session});if(!result.modifiedCount)throw new AppError(409,'Version conflict. Review the current plan.');
  await ApprovalModel.create([{episodeId:episode.episodeId,planId,providerId:owner,version:data.version,fingerprint:integrity,approvedAt,expiresAt:episode.expiresAt}],{session});
 });return {state:'APPROVED',version:data.version,fingerprint:integrity};
}
export async function grantAccess(planId:string,owner:string,body:unknown,resend=false){
 const data=grantInput.parse(body),episode=await ownedEpisode(planId,owner);requireState(episode.state,resend?['ACCESS_GRANTED','ACTIVE']:['APPROVED']);await signedContent(episode);
 if(episode.version!==data.version)throw new AppError(409,'Version conflict.');
 const token=randomToken(),activationCode=String(randomInt(10000000,100000000)),codeHash=await bcrypt.hash(activationCode,12),invitationId=randomUUID(),validUntil=new Date(Math.min(Date.now()+30*60*1000,episode.expiresAt.getTime()));
 await transaction(async session=>{
  const claimed=await EpisodeModel.updateOne({_id:episode._id,version:data.version,state:episode.state,grantInvitationId:episode.grantInvitationId,expiresAt:{$gt:new Date()}},{$set:{state:'ACCESS_GRANTED',email:data.email,grantVersion:data.version,grantInvitationId:invitationId}},{session});if(!claimed.modifiedCount)throw new AppError(409,'Enrollment changed. Reload and retry.');
  await InvitationModel.updateMany({episodeId:episode.episodeId,state:{$in:['SENT','PENDING_DELIVERY']}},{$set:{state:'REVOKED'}},{session});await AccountModel.updateMany({episodeId:episode.episodeId},{$set:{state:'REVOKED'}},{session});await PatientSessionModel.deleteMany({episodeId:episode.episodeId},{session});
  await InvitationModel.create([{episodeId:episode.episodeId,invitationId,email:data.email,tokenHash:hash(token),codeHash,validUntil,expiresAt:episode.expiresAt,state:'PENDING_DELIVERY',version:data.version,createdAt:new Date(),attempts:0}],{session});
 });
 const activationUrl=`${process.env.APP_URL || 'http://localhost:3000'}/patient/activate#token=${token}`;
 try{
  await emailDelivery.sendInvitation({to:data.email,activationUrl,validUntil});
  await transaction(async session=>{const current=await EpisodeModel.findOne({_id:episode._id,grantInvitationId:invitationId,state:'ACCESS_GRANTED',version:data.version,expiresAt:{$gt:new Date()}}).session(session);if(!current)throw new AppError(409,'Enrollment was revoked while email was being sent.');const result=await InvitationModel.updateOne({invitationId,state:'PENDING_DELIVERY',validUntil:{$gt:new Date()}},{$set:{state:'SENT'}},{session});if(!result.modifiedCount)throw new AppError(409,'Invitation is no longer usable.');});
 }catch(e){await transaction(async session=>{await InvitationModel.updateOne({invitationId},{$set:{state:'FAILED'}},{session});await EpisodeModel.updateOne({_id:episode._id,grantInvitationId:invitationId,state:'ACCESS_GRANTED'},{$set:{state:'APPROVED'},$unset:{grantVersion:1,grantInvitationId:1}},{session});});throw e;}
 return {state:'ACCESS_GRANTED',invitationId,validUntil,activationCode,delivery:'SES_ACCEPTED',identityAssurance:'email-link-plus-separately-issued-clinician-code'};
}
// Secure-link access: the patient opens /p/<token> and enters a 6-digit code. Both are stored only as
// hashes, work until the episode expires, and lock after 5 wrong codes. Publishing again replaces
// the previous link and signs out existing patient sessions. The code is returned once so the nurse
// can hand it to the patient; that is only allowed in demo/development until SMS delivery exists.
export const LINK_RECIPIENT='secure-link';
export async function publishLink(planId:string,owner:string){
 if(process.env.NODE_ENV==='production' && process.env.ENABLE_DEMO_MODE!=='true')throw new AppError(503,'Configure a verified code delivery channel before issuing patient codes.');
 const episode=await ownedEpisode(planId,owner);requireState(episode.state,['APPROVED','ACCESS_GRANTED','ACTIVE']);await signedContent(episode);
 const token=randomToken(),code=String(randomInt(0,1000000)).padStart(6,'0'),codeHash=await bcrypt.hash(code,12),invitationId=randomUUID();
 await transaction(async session=>{
  const claimed=await EpisodeModel.updateOne({_id:episode._id,version:episode.version,state:episode.state,expiresAt:{$gt:new Date()}},{$set:{state:'ACCESS_GRANTED',grantVersion:episode.version,grantInvitationId:invitationId}},{session});if(!claimed.modifiedCount)throw new AppError(409,'Discharge changed. Reload and retry.');
  await InvitationModel.updateMany({episodeId:episode.episodeId,state:{$in:['SENT','PENDING_DELIVERY']}},{$set:{state:'REVOKED'}},{session});
  await AccountModel.updateMany({episodeId:episode.episodeId},{$set:{state:'REVOKED'}},{session});await PatientSessionModel.deleteMany({episodeId:episode.episodeId},{session});
  await InvitationModel.create([{episodeId:episode.episodeId,invitationId,email:LINK_RECIPIENT,tokenHash:hash(token),codeHash,validUntil:episode.expiresAt,expiresAt:episode.expiresAt,state:'SENT',version:episode.version,createdAt:new Date(),attempts:0}],{session});
 });
 return {state:'ACCESS_GRANTED',link:`${process.env.APP_URL || 'http://localhost:3000'}/p/${token}`,code,expiresAt:episode.expiresAt,codeDelivery:'shown-to-clinician'};
}
export async function revokeAccess(planId:string,owner:string){const episode=await ownedEpisode(planId,owner,true);requireState(episode.state,['APPROVED','ACCESS_GRANTED','ACTIVE','REVOKED']);if(episode.state==='REVOKED')return {state:'REVOKED'};await transaction(async session=>{const changed=await EpisodeModel.updateOne({_id:episode._id,version:episode.version,expiresAt:{$gt:new Date()}},{$set:{state:'REVOKED'},$unset:{grantVersion:1,grantInvitationId:1}},{session});if(!changed.modifiedCount)throw new AppError(409,'Discharge changed. Reload before revoking.');await invalidate(episode.episodeId,session);});return {state:'REVOKED'};}
export {snapshot,MAX_DOCUMENT_BYTES};

export async function correctSource(planId:string,owner:string,body:unknown){
 const {z}=await import('zod');const data=z.object({version:z.number().int().positive(),sourceId:z.string().uuid(),text:z.string().trim().min(1).max(120000),transcriptConfirmed:z.boolean().default(false)}).strict().parse(body);
 const episode=await ownedEpisode(planId,owner,true);requireState(episode.state,editable);
 const source=await SourceModel.findOne({episodeId:episode.episodeId,sourceId:data.sourceId});if(!source || source.kind==='EPIC_FHIR')throw new AppError(422,'Source cannot be corrected through this endpoint. Add a clinician clarification instead.');
 await transaction(async session=>{
  const saved=await EpisodeModel.findOneAndUpdate({_id:episode._id,version:data.version,state:{$in:editable},expiresAt:{$gt:new Date()}},{$set:{state:'DRAFT'},$unset:{approval:1,grantVersion:1,grantInvitationId:1},$inc:{version:1}},{session,new:true});if(!saved)throw new AppError(409,'Version conflict. Reload source evidence.');
  await invalidate(episode.episodeId,session);await SourceModel.updateOne({_id:source._id},{$set:{text:data.text,transcriptConfirmed:data.transcriptConfirmed,dateCandidates:extractionDateCandidates(data.text)}},{session});await ClinicalPlanModel.updateOne({episodeId:episode.episodeId},{$set:{version:saved.version},$unset:{content:1,extraction:1,extractionModel:1,model:1,sourceFingerprint:1}},{session});
 });return snapshot(planId,owner);
}
