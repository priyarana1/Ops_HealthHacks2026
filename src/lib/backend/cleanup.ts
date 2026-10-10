import { randomUUID } from 'node:crypto';
import { connectDB } from '@/lib/db/mongodb';
import { deleteObject } from '@/lib/aws/s3';
import { transcribe } from '@/lib/aws/transcribe';
import { GetMedicalTranscriptionJobCommand,DeleteMedicalTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { ObjectManifestModel,patientDataModels,CleanupEvidenceModel,EpisodeModel,InvitationModel,PatientSessionModel } from './models';
export async function removeObjectArtifact(artifact:{key:string;outputKey?:string;jobName?:string}){
 if(artifact.jobName){try{const result=await transcribe.send(new GetMedicalTranscriptionJobCommand({MedicalTranscriptionJobName:artifact.jobName}));if(['QUEUED','IN_PROGRESS'].includes(result.MedicalTranscriptionJob?.TranscriptionJobStatus || ''))throw new Error('JOB_STILL_RUNNING');await transcribe.send(new DeleteMedicalTranscriptionJobCommand({MedicalTranscriptionJobName:artifact.jobName}));}catch(e){if(!(e instanceof Error && (e.name==='NotFoundException' || (e.name==='BadRequestException' && /not found|couldn.t be found|does not exist/i.test(e.message)))))throw e;}}
 await deleteObject(artifact.key);if(artifact.outputKey)await deleteObject(artifact.outputKey);
}
export async function purgeBackend(now=new Date()){
 await connectDB();let failures=0,objectsDeleted=0,recordsDeleted=0;
 // Recover stuck processing leases; version increases stop late workers overwriting a new attempt.
 await EpisodeModel.updateMany({state:'PROCESSING',processingStartedAt:{$lt:new Date(now.getTime()-15*60000)},expiresAt:{$gt:now}},{$set:{state:'DRAFT'},$unset:{processingStartedAt:1},$inc:{version:1}});
 await InvitationModel.updateMany({validUntil:{$lte:now},state:{$in:['PENDING_DELIVERY','SENT']}},{$set:{state:'REVOKED'}});await PatientSessionModel.deleteMany({validUntil:{$lte:now}});
 const artifacts=await ObjectManifestModel.find({$and:[{$or:[{expiresAt:{$lte:now}},{state:'CLEANUP_PENDING'}]},{$or:[{nextAttemptAt:{$exists:false}},{nextAttemptAt:{$lte:now}}]}]}).limit(100);
 for(const artifact of artifacts){try{await removeObjectArtifact(artifact);await ObjectManifestModel.deleteOne({_id:artifact._id});objectsDeleted++;}catch{failures++;await ObjectManifestModel.updateOne({_id:artifact._id},{$inc:{attempts:1},$set:{nextAttemptAt:new Date(now.getTime()+Math.min(3600000,30000*2**Math.min(artifact.attempts,7)))}});}}
 // Query EVERY child collection independently: MongoDB TTL may already have removed parents.
 for(const model of patientDataModels){const result=await model.collection.deleteMany({expiresAt:{$lte:now}});recordsDeleted+=result.deletedCount;}
 await CleanupEvidenceModel.create({eventId:randomUUID(),timestamp:new Date(),success:failures===0,technicalCode:failures?'RETRY_PENDING':'PURGE_COMPLETE'});
 return {objectsDeleted,recordsDeleted,failures,retryRequired:failures>0};
}
