import { NextRequest, NextResponse } from 'next/server';
import { identity } from '@/lib/auth/session';
import { handler } from '@/lib/security/http';
import { AppError } from '@/lib/security/core';
import { authorize, exchange, tokenFor } from './auth';
import { epicStore } from './store';
import { epicConfig } from './config';
import { authorizationDiagnostics } from './diagnostics';
import { fhir } from './client';
import { lastTokenFailure } from './token-diagnostics';
import { enrichClinician } from './profile';
import { fhirId, records, referencedBinary } from './resources';
export const epicRoute=handler(async(req:NextRequest)=>{
 const user=await identity('provider'),sessionId=user.sessionHash as string;
 const parts=req.nextUrl.pathname.slice('/api/epic/'.length).split('/');
 const action=parts[0];
 if(action==='token-diagnostics' && req.method==='GET'){if(process.env.NODE_ENV==='production')throw new AppError(404,'Epic endpoint not found.');return {developmentOnly:true,lastFailure:lastTokenFailure(sessionId),note:'Sanitized server-side evidence from this provider session only; expires after 15 minutes or server restart.'};}
 if(action==='diagnostics' && req.method==='GET')return authorizationDiagnostics();
 if(action==='connect' && req.method==='GET'){
  try{return NextResponse.redirect(await authorize(sessionId));}catch(e){if(e instanceof AppError)return NextResponse.redirect(new URL('/provider?epicError='+encodeURIComponent(e.message),process.env.APP_URL || 'http://localhost:3000'));throw e;}
 }
 if(action==='callback' && req.method==='GET'){
  try {
   const state=req.nextUrl.searchParams.get('state');if(!state || state.length>200)throw new AppError(400,'Missing or invalid Epic OAuth state. Reconnect.');
   await exchange(sessionId,state,req.nextUrl.searchParams.get('code') || undefined,req.nextUrl.searchParams.has('error'));
   const connection=await epicStore.getConnection(sessionId);if(connection?.clinician)await enrichClinician(sessionId,connection.clinician);
   return NextResponse.redirect(new URL('/provider?epic=connected',process.env.APP_URL || 'http://localhost:3000'));
  }catch(e){if(e instanceof AppError)return NextResponse.redirect(new URL('/provider?epicError='+encodeURIComponent(e.message),process.env.APP_URL || 'http://localhost:3000'));throw e;}
 }
 if(action==='status' && req.method==='GET'){
  let configured=true,configurationError:string|undefined;try{epicConfig();}catch(e){configured=false;configurationError=e instanceof AppError?e.message:'Epic configuration is incomplete.';}
  const c=await epicStore.getConnection(sessionId);
  return {connected:!!c,configured,configurationError,issuer:c?.issuer,scope:c?.scope,expiresAt:c?.expiresAt,clinician:c?.clinician,identityMessage:c?.identityMessage,storage:process.env.NODE_ENV==='production'?'server-database':'server-memory',persistenceEnabled:!!process.env.MONGODB_URI};
 }
 if(action==='disconnect' && req.method==='POST'){await epicStore.disconnect(sessionId);return {ok:true};}
 if(action==='patients' && parts.length===1 && req.method==='GET'){
  await tokenFor(sessionId);const id=req.nextUrl.searchParams.get('id'),name=req.nextUrl.searchParams.get('name');
  if(id)return {resourceType:'Bundle',entry:[{resource:await fhir(sessionId,'Patient/'+fhirId(id))}]};
  if(!name || name.trim().length<2 || name.length>80)throw new AppError(400,'Search by a synthetic patient name or use a FHIR Patient ID from Epic’s sandbox test data. Clinician standalone login does not select a patient.');
  return fhir(sessionId,'Patient?name='+encodeURIComponent(name.trim())+'&_count=20');
 }
 if(action==='patients' && parts.length===3 && parts[2]==='records' && req.method==='GET')return records(sessionId,fhirId(parts[1]));
 if(action==='patients' && parts.length===4 && parts[2]==='documents' && req.method==='GET')return referencedBinary(sessionId,fhirId(parts[1]),fhirId(parts[3]));
 throw new AppError(404,'Epic endpoint not found.');
});
