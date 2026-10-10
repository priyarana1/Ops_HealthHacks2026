import { createHash } from 'node:crypto';
import { sealData, unsealData } from 'iron-session';
import { AppError, hash, randomToken } from '@/lib/security/core';
import { sessionSecret } from '@/lib/auth/development';
import { discovery, epicConfig, epicJson } from './config';
import { validateState } from './state';
import { epicStore } from './store';
import { tokenRequest } from './client-auth';
import { clinicianIdentity } from './identity';
import { z } from 'zod';
export { validateState } from './state';
export async function authorize(sessionId:string) {
 const config=epicConfig(),d=await discovery(),state=randomToken(),verifier=randomToken();
 const nonce=config.scope.split(/\s+/).includes('openid')?randomToken():undefined;
 await epicStore.putAttempt({stateHash:hash(state),sessionId,verifier:d.pkce?verifier:undefined,nonce,tokenEndpoint:d.token,authMethods:d.authMethods,redirectUri:config.redirect,clientId:config.clientId,scope:config.scope,expiresAt:new Date(Date.now()+5*60*1000)});
 const url=new URL(d.authorize);const params={response_type:'code',client_id:config.clientId,redirect_uri:config.redirect,scope:config.scope,state,aud:config.base};
 for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
 if(nonce)url.searchParams.set('nonce',nonce);
 if(d.pkce){url.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));url.searchParams.set('code_challenge_method','S256');}
 return url;
}
const tokenSchema=z.object({access_token:z.string().min(1),token_type:z.string().refine(v=>v.toLowerCase()==='bearer'),expires_in:z.coerce.number().positive().finite(),scope:z.string().optional(),id_token:z.string().optional()});
export async function exchange(sessionId:string,state:string,code?:string,denied=false) {
 const attempt=await epicStore.takeAttempt(hash(state),sessionId);
 if(!attempt || attempt.expiresAt.getTime()<=Date.now() || !validateState(state,attempt.stateHash))throw new AppError(400,'Invalid, expired, or already used OAuth state. Reconnect.');
 if(denied)throw new AppError(403,'Epic authorization was denied. Sign in with an authorized clinician sandbox account and try again.');
 if(!code)throw new AppError(400,'Missing Epic authorization code.');
 const c=epicConfig();if(attempt.clientId!==c.clientId || attempt.redirectUri!==c.redirect || attempt.scope!==c.scope)throw new AppError(409,'Epic configuration changed during authorization. Reconnect.');
 const request=await tokenRequest(code,attempt.redirectUri,attempt.tokenEndpoint,attempt.verifier);
 const response=await epicJson(attempt.tokenEndpoint,{method:'POST',...request});
 if(!response.ok){const result=await response.json().catch(()=>({}));const errors:Record<string,string>={invalid_client:'Epic rejected the confidential client. Check the non-production secret or registered public key and authentication method.',invalid_grant:'Epic rejected the code. It may be expired, reused, or bound to a different redirect URI.',invalid_scope:'Epic rejected the requested scopes. Check registered APIs and EPIC_SCOPES.',access_denied:'Epic denied access for this user.'};throw new AppError(502,errors[result.error] || 'Epic authorization-code exchange failed. Verify sandbox registration and retry.');}
 const parsed=tokenSchema.safeParse(await response.json().catch(()=>null));if(!parsed.success)throw new AppError(502,'Epic returned an invalid token response.');const token=parsed.data;
 const clinician=await clinicianIdentity(token.id_token,attempt.nonce),ttl=Math.min(token.expires_in,3600);
 const encryptedToken=await sealData({accessToken:token.access_token},{password:sessionSecret(),ttl});
 // Standalone clinician tokens have no required patient/encounter context. Never infer it from identity.
 await epicStore.putConnection({sessionId,issuer:c.base,encryptedToken,scope:token.scope ?? c.scope,expiresAt:new Date(Date.now()+ttl*1000),clinician,identityMessage:clinician?undefined:'Clinician identity was not requested. Add registered openid/fhirUser scopes to display it.'});
}
export async function tokenFor(sessionId:string) {
 const connection=await epicStore.getConnection(sessionId);if(!connection)throw new AppError(401,'Epic connection is missing or expired. Reconnect to Epic Sandbox.');
 if(connection.issuer!==epicConfig().base)throw new AppError(401,'Epic connection issuer changed. Reconnect.');
 const token=await unsealData<{accessToken:string}>(connection.encryptedToken,{password:sessionSecret()});
 if(!token.accessToken){await epicStore.disconnect(sessionId);throw new AppError(401,'Epic authorization expired. Reconnect.');}
 return {accessToken:token.accessToken,connection};
}
