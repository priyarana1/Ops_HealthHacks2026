import { AppError } from '@/lib/security/core';
import { epicConfig, epicJson } from './config';
import { tokenFor } from './auth';
import { epicStore } from './store';
import { resourcePermission } from './scopes';
export async function fhir(sessionId:string,path:string) {
 const match=path.match(/^(Patient|Encounter|Condition|MedicationRequest|MedicationStatement|DocumentReference|Binary|Appointment|Practitioner|PractitionerRole)(?:\/([A-Za-z0-9.-]{1,64})|\?([^#]*))?$/);
 if(!match)throw new AppError(400,'Resource path is not permitted.');
 const {accessToken,connection}=await tokenFor(sessionId);
 if(resourcePermission(connection.scope,match[1],!!match[3])===false)throw new AppError(403,`The Epic grant does not include ${match[1]} ${match[3]?'search':'read'}. Check registered permissions and reconnect.`);
 const response=await epicJson(epicConfig().base+'/'+path,{headers:{Authorization:'Bearer '+accessToken,Accept:'application/fhir+json'}});
 if(response.status===401){await epicStore.disconnect(sessionId);throw new AppError(401,'Epic authorization expired or was revoked. Reconnect.');}
 if(response.status===403)throw new AppError(403,`Epic denied ${match[1]}. Check configured scopes, registered APIs and sandbox user permissions.`);
 if([404,405,501].includes(response.status))throw new AppError(response.status,`${match[1]} record is unavailable or this operation is unsupported.`);
 if(!response.ok)throw new AppError(response.status===400?400:502,`Epic ${match[1]} request failed. Check supported search parameters and registered APIs.`);
 const data=await response.json().catch(()=>null);
 if(!data || typeof data.resourceType!=='string' || data.resourceType==='OperationOutcome')throw new AppError(502,`Epic returned an invalid ${match[1]} response.`);
 if(match[3] && data.resourceType!=='Bundle')throw new AppError(502,'Epic search returned an unexpected resource type.');
 if(match[2] && data.id!==match[2])throw new AppError(502,'Epic returned a different record ID than requested.');
 if(!match[3] && data.resourceType!==match[1])throw new AppError(502,'Epic read returned an unexpected resource type.');
 return data;
}
