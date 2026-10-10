import { NextRequest } from 'next/server';
import { randomInt, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { handler } from '@/lib/security/http';
import { AppError, assertActive, assertPlanAccess, equal, expiration, hash, randomToken } from '@/lib/security/core';
import { connectDB } from '@/lib/db/mongodb';
import { Patient, DischargePlan, PatientAccess, AppSession, Artifact } from '@/lib/db/models';
import { cookieSession, identity, issueSession, limit, revokeSession } from '@/lib/auth/session';
import { ownedPlan, sourceText } from '@/lib/db/plans';
import { epicStore } from '@/lib/epic/store';
import { localWorkspaceEnabled } from '@/lib/auth/development';
import { records, fhirId } from '@/lib/epic/resources';
import { planContent, approvalGate, validateEvidence } from '@/lib/ai/schemas';
import { demoSource, demoPlan } from '@/lib/ai/demo';
import { processClinical } from '@/lib/aws/bedrock';
import { putAudio, s3 } from '@/lib/aws/s3';
import { startJob, pollJob, cleanupArtifact } from '@/lib/aws/transcribe';
import { purgeExpired } from '@/lib/expiration/cleanup';
export const runtime = 'nodejs';
const input = z.object({ displayName: z.string().min(1).max(100), clinicalInput: z.string().max(60000).default(''), syntheticConfirmed: z.literal(true), epicPatientId: z.string().optional(), encounterId: z.string().optional(), demo: z.boolean().default(false) }).strict();
const credentials = z.object({ email: z.string().email(), password: z.string().min(1).max(200) }).strict();
const invitation = z.object({ token: z.string().min(32).max(100) }).strict();
const verification = z.object({ token: z.string().min(32).max(100), otp: z.string().regex(/^\d{6}$/) }).strict();
const json = (r: NextRequest) => r.json().catch(() => { throw new AppError(400, 'Invalid JSON request.'); });
async function dispatch(req: NextRequest) {
    const parts = req.nextUrl.pathname.replace(/^\/api\//, '').split('/');
    const path = parts.join('/');
    const method = req.method;
    if(path==='auth/config' && method==='GET') return {localWorkspaceEnabled:localWorkspaceEnabled(),storage:process.env.NODE_ENV==='production'?'database':'server-memory'};
    if(path==='auth/development' && method==='POST') {
        if(!localWorkspaceEnabled() || !['localhost','127.0.0.1','[::1]'].includes(req.nextUrl.hostname)) throw new AppError(403,'Local synthetic workspace is only available on loopback in development without configured provider credentials.');
        await issueSession('provider','Local synthetic sandbox workspace',new Date(Date.now()+8*3600000));return {ok:true};
    }
    if (path === 'auth/signin' && method === 'POST') {
        const data = credentials.parse(await json(req));
        await limit('provider-signin', 20);
        const email = process.env.DEV_PROVIDER_EMAIL;
        const raw = process.env.DEV_PROVIDER_PASSWORD;
        const stored = process.env.DEV_PROVIDER_PASSWORD_HASH;
        if (!email || (!stored && (!raw || process.env.NODE_ENV === 'production')))
            throw new AppError(503, 'Configure development provider credentials; production requires a password hash.');
        const passwordHash = stored || await bcrypt.hash(raw!, 12);
        if (data.email.toLowerCase() !== email.toLowerCase() || !(await bcrypt.compare(data.password, passwordHash)))
            throw new AppError(401, 'Invalid sign-in credentials.');
        await issueSession('provider', email.toLowerCase(), new Date(Date.now() + 8 * 3600000), undefined, process.env.DEV_PROVIDER_ADMIN === 'true');
        return { ok: true };
    }
    if (path === 'auth/logout' && method === 'POST') {
        const cookie = await cookieSession();
        if (cookie.token) {
            await epicStore.disconnect(hash(cookie.token));
            await revokeSession(hash(cookie.token));
        }
        cookie.destroy();
        return { ok: true };
    }
    if (path.startsWith('patient/')) {
        await connectDB();
        if (path === 'patient/activate' && method === 'POST') {
            const { token } = invitation.parse(await json(req));
            await limit('activate:' + hash(token));
            const a = await PatientAccess.findOne({ invitationHash: hash(token), activated: false, expiresAt: { $gt: new Date() }, otpExpiresAt: { $gt: new Date() } });
            if (!a)
                throw new AppError(400, 'Invitation is invalid, used, or expired. Ask your clinician for a new invitation.');
            return { otpRequired: true };
        }
        if (path === 'patient/verify' && method === 'POST') {
            const { token, otp } = verification.parse(await json(req));
            await limit('verify:' + hash(token), 8);
            const a = await PatientAccess.findOneAndUpdate({ invitationHash: hash(token), activated: false, attempts: { $lt: 5 }, expiresAt: { $gt: new Date() }, otpExpiresAt: { $gt: new Date() } }, { $inc: { attempts: 1 } }, { new: true });
            if (!a || !await bcrypt.compare(otp, a.otpHash))
                throw new AppError(400, 'Invalid or expired invitation or code. Five attempts are allowed.');
            const p = await DischargePlan.findOne({ planId: a.planId, status: 'published' });
            if (!p)
                throw new AppError(404, 'Published plan is unavailable.');
            assertActive(p.expiresAt);
            const claimed = await PatientAccess.findOneAndUpdate({ _id: a._id, activated: false }, { $set: { activated: true }, $unset: { otpHash: 1 } }, { new: true });
            if (!claimed)
                throw new AppError(409, 'Invitation has already been activated.');
            const sessionHash = await issueSession('patient', p.patientId, new Date(Math.min(new Date(p.expiresAt).getTime(), Date.now() + 8 * 3600000)), p.planId);
            await PatientAccess.updateOne({ _id: a._id }, { $set: { sessionHash, sessionExpiresAt: new Date(Math.min(new Date(p.expiresAt).getTime(), Date.now() + 8 * 3600000)) } });
            return { ok: true };
        }
        if (path === 'patient/plan' && method === 'GET') {
            const s = await identity('patient');
            const p = await DischargePlan.findOne({ planId: s.planId, patientId: s.identity });
            if (!p)
                throw new AppError(404, 'Your recovery record is unavailable or expired.');
            assertPlanAccess(s, p);
            return { planId: p.planId, createdAt: p.createdAt, expiresAt: p.expiresAt, structured: p.structured, status: p.status };
        }
        throw new AppError(404, 'Endpoint not found.');
    }
    if (path === 'internal/purge-expired' && method === 'POST') {
        const supplied = req.headers.get('authorization')?.replace(/^Bearer /, '') || '';
        if (!process.env.PURGE_SECRET || !equal(supplied, process.env.PURGE_SECRET))
            throw new AppError(401, 'Unauthorized cleanup invocation.');
        return purgeExpired();
    }
    const user = await identity('provider'), owner = user.identity as string, sessionId = user.sessionHash as string;
    if (path === 'auth/me' && method === 'GET')
        return { role: 'provider', email: owner };
    await connectDB();
    if (path === 'discharges' && method === 'GET')
        return { plans: await DischargePlan.find({ owner, expiresAt: { $gt: new Date() } }).select('planId patientId status createdAt expiresAt').sort({ createdAt: -1 }).limit(50).lean() };
    if (path === 'discharges' && method === 'POST') {
        const data = input.parse(await json(req));
        if (data.demo && process.env.ENABLE_DEMO_MODE !== 'true')
            throw new AppError(403, 'Synthetic demo mode is disabled.');
        const chart = data.epicPatientId ? await records(sessionId, fhirId(data.epicPatientId)) : undefined;
        if (data.encounterId && !chart?.results.find(r => r.resourceType === 'Encounter')?.resources.some(r => r.id === data.encounterId))
            throw new AppError(400, 'Encounter is not among the retrieved patient encounters.');
        const createdAt = new Date(), expiresAt = expiration(createdAt), patientId = randomUUID(), planId = randomUUID();
        await Patient.create({ patientId, owner, source: chart ? 'epic_sandbox' : 'manual', epicFhirIssuer: chart?.issuer, epicFhirPatientId: chart?.patientId, epicEncounterId: data.encounterId, displayName: chart?.displayName || data.displayName, createdAt, expiresAt });
        try {
            await DischargePlan.create({ planId, patientId, owner, epicEncounterId: data.encounterId, source: { chart, demo: data.demo, synthetic: true, finalizedAvsRetrieved: false, avsProvided: !!data.clinicalInput }, clinicalInput: data.demo ? demoSource : data.clinicalInput, createdAt, expiresAt });
        }
        catch (e) {
            await Patient.deleteOne({ patientId });
            throw e;
        }
        return { planId, patientId, expiresAt };
    }
    if (parts[0] === 'discharges' && parts[1]) {
        const p = await ownedPlan(parts[1], owner);
        const action = parts[2];
        if (!action && method === 'GET')
            return p.toObject();
        if (!action && method === 'PATCH') {
            if (!['draft', 'review'].includes(p.status))
                throw new AppError(409, 'Approved and published plans cannot be edited.');
            const data = z.object({ revision: z.number().int(), clinicalInput: z.string().max(60000).optional(), transcript: z.string().max(60000).optional(), transcriptConfirmed: z.boolean().optional(), structured: planContent.optional() }).strict().parse(await json(req));
            if (data.structured && (data.clinicalInput !== undefined || data.transcript !== undefined))
                throw new AppError(400, 'Save source changes before editing generated content.');
            if (data.structured)
                validateEvidence(data.structured, sourceText(p));
            const { revision, ...changes } = data;
            if (changes.clinicalInput !== undefined || changes.transcript !== undefined || changes.transcriptConfirmed !== undefined) {
                Object.assign(changes, { structured: null });
            }
            const result = await DischargePlan.findOneAndUpdate({ _id: p._id, revision, status: { $in: ['draft', 'review'] }, expiresAt: { $gt: new Date() } }, { $set: { ...changes, status: changes.structured ? 'review' : 'draft' }, $inc: { revision: 1 } }, { new: true });
            if (!result)
                throw new AppError(409, 'Draft changed. Reload before saving.');
            return result.toObject();
        }
        if (action === 'process' && method === 'POST') {
            if (!['draft', 'review'].includes(p.status))
                throw new AppError(409, 'Only drafts may be processed.');
            if (p.transcript && !p.transcriptConfirmed)
                throw new AppError(409, 'Confirm or remove the supplemental transcript first.');
            if (!p.clinicalInput?.trim() && !p.transcriptConfirmed)
                throw new AppError(422, 'Chart context alone is not finalized discharge instructions. Paste a synthetic AVS or confirm clinician dictation.');
            const { demo } = z.object({ demo: z.boolean().default(false) }).strict().parse(await json(req));
            if (demo && (!p.source.demo || process.env.ENABLE_DEMO_MODE !== 'true' || p.clinicalInput !== demoSource || p.transcript))
                throw new AppError(400, 'The demo adapter only processes its exact built-in synthetic source.');
            const structured = demo ? demoPlan() : await processClinical(sourceText(p));
            validateEvidence(structured, sourceText(p));
            const saved = await DischargePlan.findOneAndUpdate({ _id: p._id, revision: p.revision, status: { $in: ['draft', 'review'] }, expiresAt: { $gt: new Date() } }, { $set: { structured, status: 'review', 'source.processing': demo ? 'synthetic-demo' : 'bedrock' }, $inc: { revision: 1 } }, { new: true });
            if (!saved)
                throw new AppError(409, 'Draft changed while processing. Reload and retry.');
            return saved.toObject();
        }
        if (action === 'approve' && method === 'POST') {
            const data = z.object({ revision: z.number().int(), clinicalReviewConfirmed: z.literal(true) }).strict().parse(await json(req));
            if (p.status !== 'review')
                throw new AppError(409, 'Generate and review the draft first.');
            const structured = planContent.parse(p.structured);
            approvalGate(structured);
            validateEvidence(structured, sourceText(p));
            const approved = await DischargePlan.findOneAndUpdate({ _id: p._id, revision: data.revision, status: 'review', expiresAt: { $gt: new Date() } }, { $set: { status: 'approved', approval: { clinician: owner, approvedAt: new Date(), revision: data.revision } }, $inc: { revision: 1 } }, { new: true });
            if (!approved)
                throw new AppError(409, 'Draft changed. Reload and review before approving.');
            return { status: 'approved' };
        }
        if (action === 'publish' && method === 'POST') {
            if (!['approved', 'published'].includes(p.status) || !p.approval)
                throw new AppError(409, 'Clinician approval is required before publishing.');
            // No delivery channel is configured. Production publishing is deliberately blocked until OTP delivery is added.
            if (process.env.NODE_ENV === 'production')
                throw new AppError(503, 'Configure a verified OTP delivery channel before production publishing.');
            const token = randomToken(), otp = String(randomInt(100000, 1000000)), otpHash = await bcrypt.hash(otp, 12), otpExpiresAt = new Date(Math.min(Date.now() + 10 * 60000, new Date(p.expiresAt).getTime()));
            await PatientAccess.deleteMany({ planId: p.planId, activated: false });
            await PatientAccess.create({ planId: p.planId, invitationHash: hash(token), otpHash, otpExpiresAt, expiresAt: p.expiresAt });
            const published = await DischargePlan.updateOne({ _id: p._id, status: { $in: ['approved', 'published'] }, expiresAt: { $gt: new Date() } }, { $set: { status: 'published' } });
            if (!published.modifiedCount && p.status !== 'published')
                throw new AppError(409, 'Could not publish plan.');
            return { status: 'published', activationUrl: `${process.env.APP_URL || 'http://localhost:3000'}/patient/activate#token=${token}`, developmentOnlyOtp: otp, otpExpiresAt };
        }
        if (action === 'expire-test' && method === 'POST') {
            if (process.env.NODE_ENV === 'production' || process.env.ENABLE_EXPIRATION_TEST !== 'true' || !user.isAdmin || !p.source.synthetic)
                throw new AppError(403, 'Synthetic expiration test is disabled.');
            const past = new Date(Date.now() - 1000);
            await DischargePlan.updateOne({ _id: p._id }, { $set: { expiresAt: past, status: 'expired' } });
            await Promise.all([Patient, PatientAccess, AppSession, Artifact].map(model => model.updateMany(model === Patient ? { patientId: p.patientId } : { planId: p.planId }, { $set: { expiresAt: past } })));
            return purgeExpired();
        }
    }
    if (path === 'audio/status' && method === 'GET') {
        let liveEnabled = false;
        if (process.env.AWS_S3_BUCKET) {
            try {
                await s3.config.credentials();
                liveEnabled = true;
            }
            catch {
                liveEnabled = false;
            }
        }
        return { liveEnabled, demoEnabled: process.env.ENABLE_DEMO_MODE === 'true', message: liveEnabled ? 'AWS credentials resolved; service permissions still require a live test.' : 'Live transcription is disabled until AWS credentials and an S3 bucket are configured.' };
    }
    if (path === 'audio/upload' && method === 'POST') {
        if (Number(req.headers.get('content-length')) > 25 * 1024 * 1024)
            throw new AppError(413, 'Audio must be under 25 MB.');
        const form = await req.formData(), planId = z.string().parse(form.get('planId')), file = form.get('audio');
        const p = await ownedPlan(planId, owner);
        if (!['draft', 'review'].includes(p.status))
            throw new AppError(409, 'Audio requires an editable draft.');
        if (!(file instanceof File) || file.size === 0 || file.size > 25 * 1024 * 1024)
            throw new AppError(400, 'Select non-empty audio under 25 MB.');
        const mime = file.type.split(';')[0];
        const format: Record<string, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/wav': 'wav', 'audio/mpeg': 'mp3' };
        if (!format[mime])
            throw new AppError(415, 'Unsupported recording format. Use webm, ogg, mp4, wav, or mp3.');
        const id = randomUUID(), key = `temporary/${planId}/${id}.${format[mime]}`, outputKey = `temporary/${planId}/${id}.json`, jobName = 'clearpath-' + id;
        // Persist cleanup ownership BEFORE upload, including uncertain upload failures.
        const artifact = await Artifact.create({ planId, owner, key, outputKey, jobName, format: format[mime], state: 'uploaded', expiresAt: new Date(Math.min(Date.now() + 3600000, new Date(p.expiresAt).getTime())) });
        await putAudio(key, Buffer.from(await file.arrayBuffer()), file.type);
        return { audioId: String(artifact._id) };
    }
    if (path === 'audio/transcribe' && method === 'POST') {
        const { audioId } = z.object({ audioId: z.string().regex(/^[a-f0-9]{24}$/) }).strict().parse(await json(req));
        const a = await Artifact.findOne({ _id: audioId, owner });
        if (!a)
            throw new AppError(404, 'Audio upload not found.');
        assertActive(a.expiresAt);
        await ownedPlan(a.planId, owner);
        return startJob(a);
    }
    if (parts[0] === 'audio' && parts[1] === 'jobs' && parts[2] && method === 'GET') {
        const a = await Artifact.findOne({ jobName: parts[2], owner });
        if (!a)
            throw new AppError(404, 'Transcription job not found.');
        assertActive(a.expiresAt);
        const p = await ownedPlan(a.planId, owner);
        const result = await pollJob(a);
        if (result.status === 'COMPLETED' && result.transcript) {
            const saved = await DischargePlan.updateOne({ _id: p._id, status: { $in: ['draft', 'review'] }, revision: p.revision, expiresAt: { $gt: new Date() } }, { $set: { transcript: result.transcript, transcriptConfirmed: false, structured: null, status: 'draft' }, $inc: { revision: 1 } });
            if (!saved.modifiedCount)
                throw new AppError(409, 'Draft changed. Reload before retrieving transcription.');
            a.state = 'cleanup-pending';
            await a.save();
            try {
                await cleanupArtifact(a);
            }
            catch {
                await Artifact.updateOne({ _id: a._id }, { $inc: { attempts: 1 } });
                return { ...result, cleanupPending: true };
            }
        }
        return result;
    }
    throw new AppError(404, 'Endpoint not found.');
}
const route = handler(dispatch);
export const GET = route;
// Cleanup uses bearer authentication, rather than browser Origin. All other writes check Origin.
export const POST = (req: NextRequest) => req.nextUrl.pathname === '/api/internal/purge-expired' ? handler(dispatch, { internal: true })(req) : route(req);
export const PATCH = route;
