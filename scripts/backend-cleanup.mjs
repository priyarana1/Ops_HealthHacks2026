import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd(),true);
if(!process.env.PURGE_SECRET)throw new Error('PURGE_SECRET is required.');
const response=await fetch((process.env.APP_URL || 'http://localhost:3000')+'/api/internal/backend-cleanup',{method:'POST',headers:{authorization:'Bearer '+process.env.PURGE_SECRET}});
if(!response.ok)throw new Error('Cleanup request failed: HTTP '+response.status);
const result=await response.json();console.log(JSON.stringify(result));if(result.retryRequired)process.exitCode=1;
