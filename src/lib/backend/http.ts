import { boundedJson,boundedMultipart } from './body';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { identity } from '@/lib/auth/session';
import { handler } from '@/lib/security/http';
import { AppError } from '@/lib/security/core';
import { createDischarge,addSource,correctSource,processDischarge,reviewDischarge,approveDischarge,grantAccess,publishLink,revokeAccess,snapshot,MAX_DOCUMENT_BYTES } from './service';
import { ownedEpisode } from './repository';
import { listTranslations,translatePlan,editTranslatedField,retranslateFields,publishTranslation } from './translation';
import { SourceModel,EpisodeModel,PatientReferenceModel,ClinicalPlanModel } from './models';
import { activatePatient,loginPatient,logoutPatient,patientIdentity,patientPlan,patientLimit,linkStatus,verifyLink } from './patient';
const json=boundedJson;
export const providerBackend=handler(async(req:NextRequest)=>{
 const provider=await identity('provider'),owner=provider.identity as string;const parts=req.nextUrl.pathname.slice('/api/discharges'.length).split('/').filter(Boolean);
 if(!parts.length){if(req.method==='POST')return createDischarge(owner,provider.sessionHash,await json(req));if(req.method==='GET'){
  // Dashboard rows: add the synthetic display name and first diagnosis so the list needs one request.
  const {connectDB}=await import('@/lib/db/mongodb');await connectDB();
  const episodes=await EpisodeModel.find({owner,expiresAt:{$gt:new Date()}}).select('episodeId planId patientId state version dischargeAt expiresAt createdAt').sort({createdAt:-1}).limit(50).lean(),ids=episodes.map(e=>e.episodeId);
  const names=new Map((await PatientReferenceModel.find({episodeId:{$in:ids}}).select('episodeId displayName').lean()).map(p=>[p.episodeId,p.displayName]));
  const diagnoses=new Map((await ClinicalPlanModel.find({episodeId:{$in:ids}}).select('episodeId content.diagnoses content.summary').lean()).map(p=>[p.episodeId,p.content?.diagnoses?.[0]?.text || p.content?.summary?.text || null]));
  return {episodes:episodes.map(e=>({...e,displayName:names.get(e.episodeId) || null,diagnosis:diagnoses.get(e.episodeId) || null}))};
 }}
 const planId=z.string().uuid().parse(parts[0]),action=parts[1];if(parts.length>(action==='translations'?4:2))throw new AppError(404,'Endpoint not found.');
 if(action==='translations'){
  // /discharges/:planId/translations[/:lang[/retranslate|/publish]]
  const lang=parts[2],step=parts[3];
  if(!lang && req.method==='GET')return listTranslations(planId,owner);
  if(lang && !step && req.method==='POST')return translatePlan(planId,owner,lang);
  if(lang && !step && req.method==='PATCH')return editTranslatedField(planId,owner,lang,await json(req));
  if(lang && step==='retranslate' && req.method==='POST')return retranslateFields(planId,owner,lang,await json(req));
  if(lang && step==='publish' && req.method==='POST')return publishTranslation(planId,owner,lang);
  throw new AppError(404,'Endpoint not found.');
 }
 if(!action && req.method==='GET')return snapshot(planId,owner);
 if(action==='sources' && req.method==='GET'){const episode=await ownedEpisode(planId,owner);return {sources:await SourceModel.find({episodeId:episode.episodeId}).lean()};}
 if(action==='sources' && req.method==='PATCH')return correctSource(planId,owner,await json(req));
 if(action==='sources' && req.method==='POST'){
  if(req.headers.get('content-type')?.startsWith('multipart/form-data')){
   if(Number(req.headers.get('content-length'))>MAX_DOCUMENT_BYTES+16384)throw new AppError(413,'Document exceeds 5 MB.');const form=await boundedMultipart(req,MAX_DOCUMENT_BYTES+16384),file=form.get('file');if(!(file instanceof File) || file.size>MAX_DOCUMENT_BYTES)throw new AppError(413,'Provide a document under 5 MB.');return addSource(planId,owner,{requestId:form.get('requestId'),kind:form.get('kind'),text:'document upload',transcriptConfirmed:false},file);
  }return addSource(planId,owner,await json(req));
 }
 if(action==='process' && req.method==='POST')return processDischarge(planId,owner);
 if((action==='review' || !action) && req.method==='PATCH')return reviewDischarge(planId,owner,await json(req));
 if(action==='approve' && req.method==='POST')return approveDischarge(planId,owner,await json(req));
 if(action==='grant-access' && req.method==='POST')return grantAccess(planId,owner,await json(req));
 if(action==='resend-invitation' && req.method==='POST')return grantAccess(planId,owner,await json(req),true);
 if(action==='revoke' && req.method==='POST')return revokeAccess(planId,owner);
 if(action==='expire-test' && req.method==='POST'){
  if(process.env.NODE_ENV==='production' || process.env.ENABLE_EXPIRATION_TEST!=='true' || !provider.isAdmin)throw new AppError(403,'Synthetic expiration test is disabled.');
  const episode=await ownedEpisode(planId,owner,true);if(!episode.synthetic)throw new AppError(403,'Synthetic episode required.');
  const {patientDataModels,ObjectManifestModel}=await import('./models');const past=new Date(Date.now()-1000),dischargeAt=new Date(past.getTime()-30*24*3600000);
  await EpisodeModel.collection.updateOne({_id:episode._id},{$set:{dischargeAt,expiresAt:past,state:'EXPIRED'}});
  for(const model of patientDataModels)await model.collection.updateMany({episodeId:episode.episodeId},{$set:{expiresAt:past}});await ObjectManifestModel.updateMany({episodeId:episode.episodeId},{$set:{expiresAt:past}});return {state:'EXPIRED',expiresAt:past,cleanupPending:true};
 }
 if(action==='publish' && req.method==='POST')return publishLink(planId,owner);
 throw new AppError(404,'Endpoint not found.');
});
export const patientBackend=handler(async(req:NextRequest)=>{
 const action=req.nextUrl.pathname.slice('/api/patient/'.length);
 if(action==='activate' && req.method==='POST')return activatePatient(await json(req));
 if(action==='login' && req.method==='POST')return loginPatient(await json(req));
 if(action==='logout' && req.method==='POST')return logoutPatient();
 if(action==='link' && req.method==='POST')return linkStatus(await json(req));
 if(action==='link/verify' && req.method==='POST')return verifyLink(await json(req));
 if(action==='me' && req.method==='GET'){const {account,episode}=await patientIdentity();return {authenticated:true,accountId:account.accountId,episodeId:episode.episodeId,planId:episode.planId,expiresAt:episode.expiresAt};}
 if(action==='discharge-plan' && req.method==='GET')return patientPlan();
 if(action==='password-reset' && req.method==='POST'){await patientLimit('password-reset-global',20);throw new AppError(503,'Self-service password reset is unavailable. Contact your clinician for a replacement invitation and separately issued code.');}
 throw new AppError(404,'Endpoint not found.');
});
