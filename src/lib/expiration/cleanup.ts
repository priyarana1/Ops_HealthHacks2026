import { randomUUID } from 'node:crypto';
import { Artifact, AppSession, PatientAccess, Patient, DischargePlan, DeletionAudit } from '@/lib/db/models';
import { cleanupArtifact } from '@/lib/aws/transcribe';
import { connectDB } from '@/lib/db/mongodb';
export async function purgeExpired(now = new Date()) {
    await connectDB();
    let failures = 0, artifactsDeleted = 0;
    // Manifests survive MongoDB TTL, so lost plan rows cannot orphan S3 objects.
    for (const artifact of await Artifact.find({ $or: [{ expiresAt: { $lte: now } }, { state: 'cleanup-pending' }] }).limit(100)) {
        try {
            await cleanupArtifact(artifact);
            artifactsDeleted++;
            await DeletionAudit.create({ eventId: randomUUID(), timestamp: new Date(), success: true });
        }
        catch {
            failures++;
            await Artifact.updateOne({ _id: artifact._id }, { $inc: { attempts: 1 } });
            await DeletionAudit.create({ eventId: randomUUID(), timestamp: new Date(), success: false, technicalCode: 'EXTERNAL_ARTIFACT_DELETE_FAILED' });
        }
    }
    const results = await Promise.all([AppSession, PatientAccess, Patient, DischargePlan].map(model => model.deleteMany({ expiresAt: { $lte: now } })));
    await DeletionAudit.create({ eventId: randomUUID(), timestamp: new Date(), success: failures === 0, technicalCode: failures ? 'RETRY_PENDING' : undefined });
    return { artifactsDeleted, failures, recordsDeleted: results.reduce((n: number, r: {
            deletedCount: number;
        }) => n + r.deletedCount, 0), retryRequired: failures > 0 };
}
