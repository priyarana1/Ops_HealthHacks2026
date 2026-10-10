import { AppError } from '@/lib/security/core';
import { fhir } from './client';
import { epicStore, type Clinician } from './store';
/** Optional profile enrichment; authorization must still work without Practitioner.Read. */
export async function enrichClinician(sessionId:string,clinician:Clinician) {
 if(!clinician.fhirUser)return;
 const reference=new URL(clinician.fhirUser).pathname.match(/\/(Practitioner|PractitionerRole)\/([A-Za-z0-9.-]{1,64})$/);
 if(!reference)return;
 try {
  let profile=await fhir(sessionId,reference[1]+'/'+reference[2]);
  if(profile.resourceType==='PractitionerRole') {
   const practitioner=profile.practitioner?.reference as string|undefined;
   if(!practitioner || !/^Practitioner\/[A-Za-z0-9.-]{1,64}$/.test(practitioner))return;
   profile=await fhir(sessionId,practitioner);
  }
  const names=profile.name as {text?:string;given?:string[];family?:string}[]|undefined;
  const displayName=names?.[0]?.text || [...(names?.[0]?.given || []),names?.[0]?.family].filter(Boolean).join(' ');
  const connection=await epicStore.getConnection(sessionId);if(connection)await epicStore.putConnection({...connection,clinician:{...clinician,displayName:displayName || undefined}});
 }catch(e){
  if(e instanceof AppError && e.status===401)throw e;
  const connection=await epicStore.getConnection(sessionId);if(connection)await epicStore.putConnection({...connection,clinician:{...clinician,profileMessage:'Clinician identity is verified. The display-name profile is unavailable under this app’s permissions.'}});
 }
}
