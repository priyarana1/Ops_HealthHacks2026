import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectVersionsCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { AppError } from '@/lib/security/core';
export const s3 = new S3Client({ region: process.env.AWS_REGION, maxAttempts: 3 });
export function bucket() { if (!process.env.AWS_S3_BUCKET)
    throw new AppError(503, 'AWS_S3_BUCKET is missing. Live audio is disabled.'); return process.env.AWS_S3_BUCKET; }
export async function putAudio(key: string, body: Buffer, contentType: string) { await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType, ServerSideEncryption: process.env.AWS_KMS_KEY_ID ? 'aws:kms' : 'AES256', SSEKMSKeyId: process.env.AWS_KMS_KEY_ID })); }
export async function getTranscript(key: string) { const r = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key })); return JSON.parse(await r.Body!.transformToString()); }
export async function deleteObject(key: string) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    // Remove object versions as well as the current object; fail/retry if permissions are missing.
    let keyMarker: string | undefined, versionMarker: string | undefined;
    do {
        const list = await s3.send(new ListObjectVersionsCommand({ Bucket: bucket(), Prefix: key, KeyMarker: keyMarker, VersionIdMarker: versionMarker }));
        const versions = [...(list.Versions || []), ...(list.DeleteMarkers || [])].filter(v => v.Key === key).map(v => ({ Key: key, VersionId: v.VersionId }));
        if (versions.length) {
            const result = await s3.send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: versions } }));
            if (result.Errors?.length)
                throw new Error('S3_VERSION_DELETE_FAILED');
        }
        keyMarker = list.IsTruncated ? list.NextKeyMarker : undefined;
        versionMarker = list.NextVersionIdMarker;
    } while (keyMarker);
}
