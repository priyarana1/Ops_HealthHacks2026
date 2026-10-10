import { TranscribeClient, StartMedicalTranscriptionJobCommand, GetMedicalTranscriptionJobCommand, DeleteMedicalTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { bucket, getTranscript, deleteObject } from './s3';
import { Artifact } from '@/lib/db/models';
import { AppError } from '@/lib/security/core';
export const transcribe = new TranscribeClient({ region: process.env.AWS_REGION, maxAttempts: 3 });
export async function startJob(artifact: InstanceType<typeof Artifact>) {
    if (artifact.state !== 'uploaded')
        throw new AppError(409, 'Audio has already been submitted.');
    // Claim before making the external call; retry polling can reconcile an uncertain service response.
    artifact.state = 'submitted';
    await artifact.save();
    await transcribe.send(new StartMedicalTranscriptionJobCommand({ MedicalTranscriptionJobName: artifact.jobName, LanguageCode: 'en-US', Specialty: 'PRIMARYCARE', Type: 'DICTATION', Media: { MediaFileUri: `s3://${bucket()}/${artifact.key}` }, MediaFormat: artifact.format, OutputBucketName: bucket(), OutputKey: artifact.outputKey, OutputEncryptionKMSKeyId: process.env.AWS_KMS_KEY_ID }));
    return { jobId: artifact.jobName, status: 'IN_PROGRESS' };
}
export async function pollJob(artifact: InstanceType<typeof Artifact>) {
    const response = await transcribe.send(new GetMedicalTranscriptionJobCommand({ MedicalTranscriptionJobName: artifact.jobName }));
    const job = response.MedicalTranscriptionJob;
    if (job?.TranscriptionJobStatus === 'FAILED')
        throw new AppError(422, 'Medical transcription failed. Check audio format, Region, and service permissions.');
    if (job?.TranscriptionJobStatus !== 'COMPLETED')
        return { status: job?.TranscriptionJobStatus || 'IN_PROGRESS' };
    const transcript = await getTranscript(artifact.outputKey);
    const text = transcript.results?.transcripts?.[0]?.transcript;
    if (typeof text !== 'string' || !text.trim())
        throw new AppError(422, 'The job returned no transcript.');
    return { status: 'COMPLETED', transcript: text, source: 'amazon-transcribe-medical' };
}
export async function cleanupArtifact(artifact: InstanceType<typeof Artifact>) {
    if (artifact.jobName && artifact.state !== 'uploaded') {
        let exists = true;
        try {
            const response = await transcribe.send(new GetMedicalTranscriptionJobCommand({ MedicalTranscriptionJobName: artifact.jobName }));
            if (['QUEUED', 'IN_PROGRESS'].includes(response.MedicalTranscriptionJob?.TranscriptionJobStatus || ''))
                throw new Error('TRANSCRIBE_STILL_RUNNING_RETRY');
        }
        catch (e) {
            if (e instanceof Error && (e.name === 'NotFoundException' || (e.name === 'BadRequestException' && /not found|couldn.t be found|does not exist/i.test(e.message))))
                exists = false;
            else
                throw e;
        }
        if (exists)
            await transcribe.send(new DeleteMedicalTranscriptionJobCommand({ MedicalTranscriptionJobName: artifact.jobName }));
    }
    await deleteObject(artifact.key);
    await deleteObject(artifact.outputKey);
    await Artifact.deleteOne({ _id: artifact._id });
}
