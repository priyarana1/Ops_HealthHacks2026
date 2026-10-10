import nextEnv from '@next/env';
import {readFile} from 'node:fs/promises';
nextEnv.loadEnvConfig(process.cwd(),true);
const base=process.env.APP_URL || 'http://localhost:3000';
if(!process.env.DEV_PROVIDER_EMAIL || !process.env.DEV_PROVIDER_PASSWORD)throw new Error('Set development provider credentials first.');
const signin=await fetch(base+'/api/auth/signin',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({email:process.env.DEV_PROVIDER_EMAIL,password:process.env.DEV_PROVIDER_PASSWORD})});if(!signin.ok)throw new Error('Provider sign-in failed.');
const cookie=signin.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),dischargeAt=new Date();dischargeAt.setUTCHours(0,0,0,0);
const response=await fetch(base+'/api/discharges',{method:'POST',headers:{origin:base,'content-type':'application/json',cookie},body:JSON.stringify({requestId:process.env.SYNTHETIC_SEED_REQUEST_ID || '12345678-1234-4234-8234-123456789013',syntheticConfirmed:true,patient:{displayName:'Synthetic Heart Failure Example'},dischargeAt:dischargeAt.toISOString(),dischargeTimezone:'UTC',dischargeConfirmed:false,clinicalInput:await readFile(new URL('../sample-data/heart-failure-discharge.txt',import.meta.url),'utf8'),sourceKind:'FINAL_AVS'})});
if(!response.ok)throw new Error('Seed request failed: HTTP '+response.status+'. Existing request IDs cannot be reused with changed data.');const result=await response.json();console.log(JSON.stringify({planId:result.planId,episodeId:result.episodeId,state:result.state,expiresAt:result.expiresAt}));
