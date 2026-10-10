import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db/mongodb';
import { sessionSecret } from '@/lib/auth/development';
import { AppError,hash,randomToken } from '@/lib/security/core';
import { activationInput,loginInput } from './contracts';
import { AccountModel,EpisodeModel,InvitationModel,PatientSessionModel,ClinicalPlanModel } from './models';
import { transaction,signedContent } from './repository';
import { activeEpisode } from './policy';
const unavailable=()=>new AppError(401,'Unable to verify access. Check your credentials or contact your clinician.');
export async function patientCookie(){return getIronSession<{token?:string}>(await cookies(),{cookieName:'clearpath_patient',password:sessionSecret(),ttl:8*3600,cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'}});}
export async function patientLimit(key:string,max=10){
 await connectDB();const {RateLimit}=await import('@/lib/db/models');const windowMs=10*60*1000,slot=Math.floor(Date.now()/windowMs);
 try{const count=await RateLimit.findOneAndUpdate({key:hash('backend:'+key+':'+slot)},{$inc:{count:1},$setOnInsert:{expiresAt:new Date((slot+1)*windowMs)}},{upsert:true,new:true});if(count.count>max)throw new AppError(429,'Too many attempts. Please wait before retrying.');}catch(e){if(e instanceof AppError)throw e;throw new AppError(503,'Authentication is temporarily unavailable.');}
}
export async function activatePatient(body:unknown){
 const data=activationInput.parse(body);await patientLimit('activate:'+hash(data.token),8);await patientLimit('activation-global',100);
 const invitation=await InvitationModel.findOneAndUpdate({tokenHash:hash(data.token),state:'SENT',attempts:{$lt:5},validUntil:{$gt:new Date()},expiresAt:{$gt:new Date()}},{$inc:{attempts:1}},{new:true});
 if(!invitation || !await bcrypt.compare(data.activationCode,invitation.codeHash))throw unavailable();
 const passwordHash=await bcrypt.hash(data.password,12);
 await transaction(async session=>{
  const episode=await EpisodeModel.findOne({episodeId:invitation.episodeId,state:'ACCESS_GRANTED',grantVersion:invitation.version,grantInvitationId:invitation.invitationId,expiresAt:{$gt:new Date()}}).session(session);if(!episode || !episode.approval)throw unavailable();
  await signedContent(episode);
  const claimed=await InvitationModel.updateOne({_id:invitation._id,state:'SENT',validUntil:{$gt:new Date()},expiresAt:{$gt:new Date()}},{$set:{state:'USED'},$unset:{codeHash:1}},{session});if(!claimed.modifiedCount)throw unavailable();
  await AccountModel.findOneAndUpdate({episodeId:episode.episodeId},{$set:{email:invitation.email,passwordHash,state:'ACTIVE',version:episode.version,activatedAt:new Date()},$setOnInsert:{accountId:randomUUID(),patientId:episode.patientId,expiresAt:episode.expiresAt}},{session,upsert:true});
  await PatientSessionModel.deleteMany({episodeId:episode.episodeId},{session});await EpisodeModel.updateOne({_id:episode._id,state:'ACCESS_GRANTED',grantInvitationId:invitation.invitationId},{$set:{state:'ACTIVE'}},{session});
 });return {activated:true};
}
export async function loginPatient(body:unknown){
 const data=loginInput.parse(body);await patientLimit('login:'+hash(data.email));await patientLimit('login-global',200);
 const accounts=await AccountModel.find({email:data.email,state:'ACTIVE',expiresAt:{$gt:new Date()}}).sort({activatedAt:-1}).limit(10);
 let selected:typeof accounts[number]|undefined;for(const account of accounts)if(await bcrypt.compare(data.password,account.passwordHash)){selected=account;break;}
 // Constant bcrypt work for absent accounts limits simple account enumeration by timing.
 if(!accounts.length)await bcrypt.compare(data.password,'$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW');
 if(!selected)throw unavailable();
 const episode=await EpisodeModel.findOne({episodeId:selected.episodeId,state:'ACTIVE',version:selected.version,grantVersion:selected.version,expiresAt:{$gt:new Date()}});if(!episode)throw unavailable();await signedContent(episode);
 const cookie=await patientCookie();if(cookie.token)await PatientSessionModel.deleteOne({sessionHash:hash(cookie.token)});
 const token=randomToken(),validUntil=new Date(Math.min(Date.now()+8*3600000,episode.expiresAt.getTime()));
 await PatientSessionModel.create({sessionHash:hash(token),episodeId:episode.episodeId,accountId:selected.accountId,expiresAt:episode.expiresAt,validUntil});cookie.token=token;await cookie.save();return {authenticated:true,validUntil};
}
export async function patientIdentity(){
 await connectDB();const cookie=await patientCookie();if(!cookie.token)throw unavailable();
 const session=await PatientSessionModel.findOne({sessionHash:hash(cookie.token),validUntil:{$gt:new Date()},expiresAt:{$gt:new Date()}});if(!session)throw unavailable();
 const account=await AccountModel.findOne({accountId:session.accountId,episodeId:session.episodeId,state:'ACTIVE',expiresAt:{$gt:new Date()}});
 const episode=await EpisodeModel.findOne({episodeId:session.episodeId,state:'ACTIVE',expiresAt:{$gt:new Date()}});
 if(!account || !episode || account.patientId!==episode.patientId || account.version!==episode.version || episode.grantVersion!==episode.version)throw unavailable();activeEpisode(episode);await signedContent(episode);return {account,episode};
}
export async function patientPlan(){const {account,episode}=await patientIdentity();const plan=await ClinicalPlanModel.findOne({episodeId:episode.episodeId,patientId:account.patientId,version:episode.version});if(!plan?.content)throw unavailable();const current=await EpisodeModel.findOne({_id:episode._id,state:'ACTIVE',version:account.version,grantVersion:account.version,expiresAt:{$gt:new Date()}});if(!current)throw unavailable();return {episodeId:episode.episodeId,planId:episode.planId,patientId:episode.patientId,dischargeAt:episode.dischargeAt,dischargeTimezone:episode.dischargeTimezone,expiresAt:episode.expiresAt,state:episode.state,version:episode.version,approvedVersion:episode.approval!.version,language:'en',content:plan.content};}
export async function logoutPatient(){const cookie=await patientCookie();if(cookie.token){await connectDB();await PatientSessionModel.deleteOne({sessionHash:hash(cookie.token)});}cookie.destroy();return {ok:true};}
