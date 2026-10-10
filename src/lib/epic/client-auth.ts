import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import { AppError } from '@/lib/security/core';
import { epicConfig, trustedEndpoint } from './config';
const formEncode=(value:string)=>new URLSearchParams({v:value}).toString().slice(2);
export async function tokenRequest(code:string,redirectUri:string,tokenEndpoint:string,verifier?:string) {
 const config=epicConfig();const body=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri});
 if(verifier)body.set('code_verifier',verifier);
 const headers:Record<string,string>={'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'};
 if(config.authMethod==='client_secret_basic')headers.Authorization='Basic '+Buffer.from(formEncode(config.clientId)+':'+formEncode(process.env.EPIC_CLIENT_SECRET!)).toString('base64');
 if(config.authMethod==='client_secret_post'){body.set('client_id',config.clientId);body.set('client_secret',process.env.EPIC_CLIENT_SECRET!);}
 if(config.authMethod==='private_key_jwt'){
  const algorithm=process.env.EPIC_PRIVATE_KEY_ALG || 'RS384';if(!['RS384','ES384'].includes(algorithm))throw new AppError(503,'Epic private-key assertions require RS384 or ES384.');
  try {
   const pem=process.env.EPIC_PRIVATE_KEY_PEM?.replace(/\\n/g,'\n') || await readFile(process.env.EPIC_PRIVATE_KEY_PATH!,'utf8');
   const key=await importPKCS8(pem,algorithm),now=Math.floor(Date.now()/1000);
   const assertion=await new SignJWT({}).setProtectedHeader({alg:algorithm,typ:'JWT',...(process.env.EPIC_PRIVATE_KEY_ID?{kid:process.env.EPIC_PRIVATE_KEY_ID}:{})}).setIssuer(config.clientId).setSubject(config.clientId).setAudience(trustedEndpoint(tokenEndpoint)).setJti(randomUUID()).setIssuedAt(now).setNotBefore(now-5).setExpirationTime(now+240).sign(key);
   body.set('client_assertion_type','urn:ietf:params:oauth:client-assertion-type:jwt-bearer');body.set('client_assertion',assertion);
  }catch(e){if(e instanceof AppError)throw e;throw new AppError(503,'Cannot sign the Epic client assertion. Check private-key format, algorithm and registered public key.');}
 }
 return {body,headers};
}
