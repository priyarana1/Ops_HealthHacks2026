import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { connectDB } from '@/lib/db/mongodb';
import { AppSession, RateLimit } from '@/lib/db/models';
import { AppError, hash, randomToken } from '@/lib/security/core';
import { developmentState, sessionSecret } from './development';
export interface Session { token?:string }
export async function cookieSession() {
 return getIronSession<Session>(await cookies(),{password:sessionSecret(),cookieName:'clearpath_session',ttl:8*3600,cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'}});
}
export async function identity(role?:'provider'|'patient') {
 const cookie=await cookieSession();if(!cookie.token) throw new AppError(401,'Please sign in with the required role.');
 const key=hash(cookie.token);
 if(process.env.NODE_ENV!=='production') {
  const local=developmentState().sessions.get(key);
  if(local && (!role || role==='provider')) return local;
  if(role==='provider' || !process.env.MONGODB_URI) throw new AppError(401,'Please sign in to the local provider workspace.');
 }
 await connectDB(); const session=await AppSession.findOne({sessionHash:key,expiresAt:{$gt:new Date()}});
 if(!session || (role && session.role!==role)) throw new AppError(401,'Please sign in with the required role.');
 return session;
}
export async function issueSession(role:string,identity:string,expiresAt:Date,planId?:string,isAdmin=false) {
 const cookie=await cookieSession();
 if(cookie.token) await revokeSession(hash(cookie.token));
 const token=randomToken(),sessionHash=hash(token);
 if(role==='provider' && process.env.NODE_ENV!=='production') developmentState().sessions.set(sessionHash,{sessionHash,role:'provider',identity,expiresAt,isAdmin});
 else {await connectDB();await AppSession.create({sessionHash,role,identity,planId,expiresAt,isAdmin});}
 cookie.token=token;await cookie.save();return sessionHash;
}
export async function revokeSession(sessionHash:string) {
 if(process.env.NODE_ENV!=='production' && developmentState().sessions.delete(sessionHash)) return;
 if(process.env.MONGODB_URI) {await connectDB();await AppSession.deleteOne({sessionHash});}
}
export async function limit(key:string,max=10,windowMs=10*60*1000) {
 const now=Date.now(),slot=Math.floor(now/windowMs),id=hash(key+slot),expiresAt=(slot+1)*windowMs;
 if(process.env.NODE_ENV!=='production') {const limits=developmentState().limits;const record=limits.get(id) || {count:0,expiresAt};record.count++;limits.set(id,record);if(record.count>max) throw new AppError(429,'Too many attempts. Please wait and try again.');return;}
 await connectDB();const record=await RateLimit.findOneAndUpdate({key:id},{$inc:{count:1},$setOnInsert:{expiresAt:new Date(expiresAt)}},{upsert:true,new:true});if(record.count>max) throw new AppError(429,'Too many attempts. Please wait and try again.');
}
