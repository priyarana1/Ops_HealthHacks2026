import { createLocalJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import { AppError, equal } from '@/lib/security/core';
import { epicConfig, epicJson, trustedEndpoint } from './config';
import type { Clinician } from './store';
const metadataSchema=z.object({issuer:z.string(),jwks_uri:z.string()});
const keysSchema=z.object({keys:z.array(z.object({kty:z.string()}).passthrough()).min(1)});
export async function clinicianIdentity(idToken:string|undefined,nonce:string|undefined):Promise<Clinician|undefined> {
 const c=epicConfig();if(!c.scope.split(/\s+/).includes('openid'))return undefined;
 if(!idToken || !nonce)throw new AppError(502,'Epic did not return the requested clinician identity token. Check OpenID Connect registration.');
 const response=await epicJson(c.base+'/.well-known/openid-configuration');
 if(!response.ok)throw new AppError(502,'Epic identity discovery failed. No clinician identity was accepted.');
 const metadata=metadataSchema.safeParse(await response.json().catch(()=>null));
 if(!metadata.success || metadata.data.issuer!=='https://fhir.epic.com/interconnect-fhir-oauth/oauth2')throw new AppError(502,'Epic identity discovery returned an unexpected issuer.');
 const jwks=await epicJson(trustedEndpoint(metadata.data.jwks_uri));if(!jwks.ok)throw new AppError(502,'Epic signing keys could not be retrieved.');
 const keys=keysSchema.safeParse(await jwks.json().catch(()=>null));if(!keys.success)throw new AppError(502,'Epic signing keys are invalid.');
 try {
  const {payload}=await jwtVerify(idToken,createLocalJWKSet(keys.data),{issuer:metadata.data.issuer,audience:c.clientId,algorithms:['RS256','RS384','ES256','ES384'],requiredClaims:['iss','sub','aud','exp','iat','nonce'],clockTolerance:5});
  if(typeof payload.nonce!=='string' || !equal(payload.nonce,nonce) || (payload.azp!==undefined && payload.azp!==c.clientId) || (Array.isArray(payload.aud) && payload.aud.length>1 && payload.azp!==c.clientId))throw new Error('Invalid identity binding');
  const fhirUser=typeof payload.fhirUser==='string'?payload.fhirUser:undefined;
  if(fhirUser) {const url=new URL(trustedEndpoint(fhirUser));if(!/\/(Practitioner|PractitionerRole)\/[A-Za-z0-9.-]{1,64}$/.test(url.pathname))throw new AppError(403,'Epic returned a non-clinician identity. Use the clinician/staff sandbox user type.');}
  return {subject:payload.sub!,fhirUser,verified:true};
 }catch(e){if(e instanceof AppError)throw e;throw new AppError(502,'Epic clinician identity failed signature, issuer, audience, expiration or nonce verification. Reconnect.');}
}
