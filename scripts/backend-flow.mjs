// Real-service synthetic demo. No mocks; pauses for human review and the emailed link.
import nextEnv from '@next/env';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
nextEnv.loadEnvConfig(process.cwd(),true);
const approvalOnly=process.argv.includes('--approval-only');
const base=process.env.APP_URL || 'http://localhost:3000',providerCookies=new Map(),patientCookies=new Map();
const rl=createInterface({input:process.stdin,output:process.stdout});
async function api(path,method='GET',body,patient=false){const jar=patient?patientCookies:providerCookies;const response=await fetch(base+'/api/'+path,{method,headers:{origin:base,'content-type':'application/json',cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},body:body===undefined?undefined:JSON.stringify(body),redirect:'error'});for(const c of response.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}const result=await response.json();if(!response.ok)throw new Error(`HTTP ${response.status}: ${result.error || 'Request failed'}`);return result;}
try{
 if(!process.env.DEV_PROVIDER_EMAIL || !process.env.DEV_PROVIDER_PASSWORD)throw new Error('Configure development provider credentials; this script does not bypass login.');
 await api('auth/signin','POST',{email:process.env.DEV_PROVIDER_EMAIL,password:process.env.DEV_PROVIDER_PASSWORD});
 const dischargeAt=new Date(Date.now()-86400000).toISOString();
 const draft=await api('discharges','POST',{requestId:randomUUID(),syntheticConfirmed:true,patient:{displayName:'Synthetic Heart Failure Demo'},dischargeAt,dischargeTimezone:'UTC',dischargeConfirmed:false});
 const text=await readFile(new URL('../sample-data/heart-failure-discharge.txt',import.meta.url),'utf8');
 if(approvalOnly){
  await api(`discharges/${draft.planId}/sources`,'POST',{requestId:randomUUID(),kind:'FINAL_AVS',text});
 }else{
 const upload=new FormData();upload.set('requestId',randomUUID());upload.set('kind','FINAL_AVS');upload.set('file',new Blob([text],{type:'text/plain'}),'synthetic-discharge.txt');
 const uploaded=await fetch(base+`/api/discharges/${draft.planId}/sources`,{method:'POST',headers:{origin:base,cookie:[...providerCookies].map(([k,v])=>`${k}=${v}`).join('; ')},body:upload});if(!uploaded.ok)throw new Error('Synthetic document upload failed: HTTP '+uploaded.status);
 }
 let data=await api(`discharges/${draft.planId}/process`,'POST',{});console.log('Real Bedrock draft for synthetic source:');console.log(JSON.stringify(data.plan.content,null,2));
 if(await rl.question('Compare with sample-data/heart-failure-discharge.txt. Type REVIEWED to confirm your clinical review, or anything else to stop: ')!=='REVIEWED')throw new Error('Stopped before approval. Draft remains unapproved.');
 const resolutions=[];for(const issue of data.plan.content.issues.filter(i=>i.severity==='critical')){const resolution=await rl.question(`Resolve ${issue.id}: ${issue.description}\nClinician resolution (empty stops): `);if(!resolution.trim())throw new Error('Unresolved issue.');resolutions.push({id:issue.id,resolution});}
 data=await api(`discharges/${draft.planId}/review`,'PATCH',{version:data.episode.version,dischargeConfirmed:true,resolutions});await api(`discharges/${draft.planId}/approve`,'POST',{version:data.episode.version,clinicalReviewConfirmed:true});
 if(approvalOnly){
  const saved=await api(`discharges/${draft.planId}`);
  if(saved.episode.state!=='APPROVED')throw new Error('Saved episode was not APPROVED.');
  console.log(JSON.stringify({planId:draft.planId,state:saved.episode.state,version:saved.episode.version,dischargeAt:saved.episode.dischargeAt,expiresAt:saved.episode.expiresAt},null,2));
  console.log('Real MongoDB + Bedrock flow completed through approval and read-back. No S3, audio, email or patient activation was tested.');
 }else{
 const email=await rl.question('Enter a verified synthetic-testing recipient email: ');const grant=await api(`discharges/${draft.planId}/grant-access`,'POST',{version:data.episode.version,email,enrollmentAuthorized:true});
 console.log('SES accepted the invitation. Check the recipient inbox; acceptance alone does not prove inbox delivery.');
 const link=await rl.question('Paste the activation URL from that email (kept in memory, not logged): '),token=new URLSearchParams(new URL(link).hash.slice(1)).get('token');if(!token)throw new Error('Missing invitation token.');
 // Synthetic disposable password generated only for this temporary test account; never printed.
 const password=randomUUID()+randomUUID();await api('patient/activate','POST',{token,activationCode:grant.activationCode,password},true);await api('patient/login','POST',{email,password},true);const plan=await api('patient/discharge-plan','GET',undefined,true);console.log('Patient retrieved approved plan:',plan.planId);
 if(process.env.ENABLE_EXPIRATION_TEST==='true' && process.env.DEV_PROVIDER_ADMIN==='true'){
  await api(`discharges/${draft.planId}/expire-test`,'POST',{});
  let denied=false;try{await api('patient/discharge-plan','GET',undefined,true);}catch{denied=true;}if(!denied)throw new Error('Expiration denial test failed.');
  if(!process.env.PURGE_SECRET)throw new Error('Set PURGE_SECRET to run explicit cleanup.');const r=await fetch(base+'/api/internal/backend-cleanup',{method:'POST',headers:{authorization:'Bearer '+process.env.PURGE_SECRET}});if(!r.ok)throw new Error('Cleanup failed.');const cleaned=await r.json();console.log('Expiration denied access; cleanup:',cleaned);if(cleaned.retryRequired)throw new Error('S3 cleanup requires a retry.');
 }else console.log('Expiration simulation skipped: enable the admin-only synthetic test flags to exercise it.');
 console.log('Real-service steps above completed. No mock adapters were used.');
 }
}catch(error){console.error(error instanceof Error?error.message:'Demo failed.');process.exitCode=1;}finally{rl.close();}
