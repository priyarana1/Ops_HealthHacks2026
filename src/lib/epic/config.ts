import { z } from 'zod';
import { AppError } from '@/lib/security/core';
export const sandboxBase='https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4';
export type ClientAuthMethod='client_secret_basic'|'client_secret_post'|'private_key_jwt';
export function epicConfig() {
 const base=(process.env.EPIC_FHIR_BASE_URL || sandboxBase).replace(/\/$/,'');
 if(base!==sandboxBase)throw new AppError(400,'This prototype is restricted to the Epic public synthetic sandbox.');
 const clientId=process.env.EPIC_CLIENT_ID?.trim(),redirect=process.env.EPIC_REDIRECT_URI;
 if(!clientId || !redirect)throw new AppError(503,'Set EPIC_CLIENT_ID to the non-production ID and EPIC_REDIRECT_URI to the exact registered callback.');
 let url:URL;try{url=new URL(redirect);}catch{throw new AppError(503,'EPIC_REDIRECT_URI must be a valid registered URL.');}
 if(url.pathname!=='/api/epic/callback' || url.search || url.hash || url.origin!==new URL(process.env.APP_URL || 'http://localhost:3000').origin)throw new AppError(503,'EPIC_REDIRECT_URI must match APP_URL and the registered /api/epic/callback exactly.');
 const method=process.env.EPIC_TOKEN_AUTH_METHOD || (process.env.EPIC_CLIENT_SECRET?'client_secret_basic':process.env.EPIC_PRIVATE_KEY_PEM || process.env.EPIC_PRIVATE_KEY_PATH?'private_key_jwt':'');
 if(!['client_secret_basic','client_secret_post','private_key_jwt'].includes(method))throw new AppError(503,'Configure EPIC_TOKEN_AUTH_METHOD and the matching confidential-client secret or private key.');
 if(method.startsWith('client_secret') && !process.env.EPIC_CLIENT_SECRET)throw new AppError(503,'EPIC_CLIENT_SECRET is required for the configured authentication method.');
 if(method==='private_key_jwt' && !(process.env.EPIC_PRIVATE_KEY_PEM || process.env.EPIC_PRIVATE_KEY_PATH))throw new AppError(503,'Configure EPIC_PRIVATE_KEY_PEM or EPIC_PRIVATE_KEY_PATH for private_key_jwt.');
 // Epic documents openid as sufficient for sandbox authorization; resource access also depends on registered APIs.
 const scope=process.env.EPIC_SCOPES?.trim() || 'openid';
 if(/(?:^|\s)(launch(?:\/\S+)?|offline_access|online_access)(?:\s|$)/.test(scope))throw new AppError(503,'Standalone clinician authorization must not request launch context or refresh-token scopes in this prototype.');
 return {base,clientId,redirect,scope,authMethod:method as ClientAuthMethod};
}
export function trustedEndpoint(url:string) {
 let parsed:URL;try{parsed=new URL(url);}catch{throw new AppError(502,'Epic discovery returned an invalid endpoint.');}
 if(parsed.protocol!=='https:' || parsed.hostname!=='fhir.epic.com' || parsed.port || parsed.username || parsed.password || parsed.hash || !parsed.pathname.startsWith('/interconnect-fhir-oauth/'))throw new AppError(502,'Untrusted Epic endpoint.');
 return parsed.toString();
}
export async function epicJson(url:string,init:RequestInit={}) {
 let response:Response;try{response=await fetch(trustedEndpoint(url),{...init,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new AppError(502,'Cannot reach Epic Sandbox. Check network access and retry; no demo data was substituted.');}
 return response;
}
const smartSchema=z.object({authorization_endpoint:z.string(),token_endpoint:z.string(),token_endpoint_auth_methods_supported:z.array(z.string()).optional(),code_challenge_methods_supported:z.array(z.string()).optional(),scopes_supported:z.array(z.string()).optional()});
export async function discovery() {
 const {base,authMethod}=epicConfig();const response=await epicJson(base+'/.well-known/smart-configuration');
 if(!response.ok)throw new AppError(502,'Epic SMART discovery failed. Authorization was not started.');
 const parsed=smartSchema.safeParse(await response.json().catch(()=>null));if(!parsed.success)throw new AppError(502,'Epic SMART discovery returned invalid metadata.');const d=parsed.data;
 if(d.token_endpoint_auth_methods_supported && !d.token_endpoint_auth_methods_supported.includes(authMethod))throw new AppError(503,'Epic discovery does not support the configured client authentication method.');
 return {authorize:trustedEndpoint(d.authorization_endpoint),token:trustedEndpoint(d.token_endpoint),authMethods:d.token_endpoint_auth_methods_supported,pkce:d.code_challenge_methods_supported?d.code_challenge_methods_supported.includes('S256'):true};
}
