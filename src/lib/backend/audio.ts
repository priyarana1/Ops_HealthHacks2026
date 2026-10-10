import { boundedJson,boundedMultipart } from './body';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GetMedicalTranscriptionJobCommand,StartMedicalTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { z } from 'zod';
import { identity } from '@/lib/auth/session';
import { handler } from '@/lib/security/http';
import { AppError } from '@/lib/security/core';
import { putAudio,bucket,getTranscript } from '@/lib/aws/s3';
import { transcribe } from '@/lib/aws/transcribe';
import { ObjectManifestModel,SourceModel } from './models';
import { ownedEpisode } from './repository';
import { requireState } from './policy';
import { addSource } from './service';
export function audioFormat(mime:string,bytes:Buffer){
 const type=mime.split(';')[0];
 const signature:Record<string,boolean>={'audio/wav':bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WAVE','audio/webm':bytes.subarray(0,4).toString('hex')==='1a45dfa3','audio/ogg':bytes.subarray(0,4).toString()==='OggS','audio/mp4':bytes.subarray(4,8).toString()==='ftyp','audio/mpeg':bytes.subarray(0,3).toString()==='ID3' || (bytes[0]===255 && (bytes[1]&224)===224)};
 if(!signature[type])throw new AppError(415,'Recording content does not match a supported WAV, WebM, Ogg, MP4 or MP3 format.');return ({'audio/wav':'wav','audio/webm':'webm','audio/ogg':'ogg','audio/mp4':'mp4','audio/mpeg':'mp3'} as Record<string,string>)[type];
}
export const audioBackend=handler(async(req:NextRequest)=>{
 const user=await identity('provider'),action=req.nextUrl.pathname.slice('/api/audio/'.length);const owner=user.identity as string;
 if(action==='status' && req.method==='GET')return {configured:!!(process.env.AWS_REGION && process.env.AWS_S3_BUCKET),connected:false,message:'Configuration is not a service connectivity test. Medical transcription requires a live upload/job test.'};
 if(!process.env.AWS_REGION || !process.env.AWS_S3_BUCKET)throw new AppError(503,'Configure AWS_REGION, AWS_S3_BUCKET and AWS SDK credentials for medical transcription.');
 if(action==='upload' && req.method==='POST'){
  if(Number(req.headers.get('content-length'))>25*1024*1024+16384)throw new AppError(413,'Audio exceeds 25 MB.');
  const form=await boundedMultipart(req,25*1024*1024+16384),planId=z.string().uuid().parse(form.get('planId')),file=form.get('audio');
  const episode=await ownedEpisode(planId,owner);requireState(episode.state,['DRAFT','PENDING_REVIEW']);
  if(!(file instanceof File) || !file.size || file.size>25*1024*1024)throw new AppError(413,'Provide non-empty audio under 25 MB.');const buffer=Buffer.from(await file.arrayBuffer()),format=audioFormat(file.type,buffer),objectId=randomUUID(),key=`clinical/${objectId}.${format}`,outputKey=`clinical/${objectId}.json`,jobName='clearpath-'+objectId;
  await ObjectManifestModel.create({episodeId:episode.episodeId,objectId,key,outputKey,jobName,format,state:'PENDING_UPLOAD',expiresAt:episode.expiresAt,attempts:0});
  try{await putAudio(key,buffer,file.type);await ObjectManifestModel.updateOne({objectId},{$set:{state:'UPLOADED'}});}catch{await ObjectManifestModel.updateOne({objectId},{$set:{state:'CLEANUP_PENDING'}});throw new AppError(503,'Audio upload failed. No transcript was created.');}return {audioId:objectId,jobId:jobName};
 }
 const body=action==='transcribe' && req.method==='POST'?z.object({audioId:z.string().uuid()}).strict().parse(await boundedJson(req)):undefined;
 const jobId=action.startsWith('jobs/')?action.slice(5):undefined;
 if(!body && !jobId)throw new AppError(404,'Audio endpoint not found.');
 const artifact=await ObjectManifestModel.findOne(body?{objectId:body.audioId}:{jobName:jobId});if(!artifact || artifact.expiresAt<=new Date())throw new AppError(404,'Audio record unavailable.');
 const episode=await import('./models').then(m=>m.EpisodeModel.findOne({episodeId:artifact.episodeId,owner}));if(!episode)throw new AppError(404,'Audio record unavailable.');await ownedEpisode(episode.planId,owner);requireState(episode.state,['DRAFT','PENDING_REVIEW']);
 if(body){const claimed=await ObjectManifestModel.updateOne({_id:artifact._id,state:'UPLOADED'},{$set:{state:'SUBMITTED'}});if(!claimed.modifiedCount)throw new AppError(409,'Audio was already submitted. Poll its job instead.');
  try{await transcribe.send(new StartMedicalTranscriptionJobCommand({MedicalTranscriptionJobName:artifact.jobName,LanguageCode:'en-US',Specialty:'PRIMARYCARE',Type:'DICTATION',Media:{MediaFileUri:`s3://${bucket()}/${artifact.key}`},MediaFormat:artifact.format as 'wav',OutputBucketName:bucket(),OutputKey:artifact.outputKey,OutputEncryptionKMSKeyId:process.env.AWS_KMS_KEY_ID}));}catch{throw new AppError(503,'Transcription submission failed or is uncertain. Poll this job to reconcile; no transcript was fabricated.');}return {jobId:artifact.jobName,status:'IN_PROGRESS'};
 }
 if(req.method!=='GET')throw new AppError(405,'Method not allowed.');const existing=await SourceModel.findOne({episodeId:episode.episodeId,requestId:artifact.objectId});if(existing)return {status:'COMPLETED',sourceId:existing.sourceId,transcript:existing.text,transcriptConfirmed:existing.transcriptConfirmed};
 try{const result=await transcribe.send(new GetMedicalTranscriptionJobCommand({MedicalTranscriptionJobName:artifact.jobName})),status=result.MedicalTranscriptionJob?.TranscriptionJobStatus;if(status==='FAILED'){await ObjectManifestModel.updateOne({_id:artifact._id},{$set:{state:'CLEANUP_PENDING'}});throw new AppError(422,'Medical transcription failed. Check the recording and permissions.');}if(status!=='COMPLETED')return {status:status || 'IN_PROGRESS'};
  const transcript=await getTranscript(artifact.outputKey!),text=transcript.results?.transcripts?.[0]?.transcript;if(typeof text!=='string' || !text.trim())throw new AppError(422,'Transcription returned no readable text.');const source=await addSource(episode.planId,owner,{requestId:artifact.objectId,kind:'AUDIO_TRANSCRIPT',text,transcriptConfirmed:false});await ObjectManifestModel.updateOne({_id:artifact._id},{$set:{state:'CLEANUP_PENDING'}});return {status:'COMPLETED',sourceId:source.sourceId,transcript:text,transcriptConfirmed:false};
 }catch(e){if(e instanceof AppError)throw e;throw new AppError(503,'Transcription retrieval failed. No demo text was substituted.');}
});
