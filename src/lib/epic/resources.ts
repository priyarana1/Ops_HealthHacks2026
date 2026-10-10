import { fhir } from './client';
import { AppError } from '@/lib/security/core';
import { normalize } from './normalize';
import { epicConfig } from './config';
import type { Bundle, FhirResource, ResourceResult } from './types';
export const resourceTypes = ['Encounter', 'Condition', 'MedicationRequest', 'MedicationStatement', 'DocumentReference', 'Appointment'] as const;
export const fhirId = (id: string) => { if (!/^[A-Za-z0-9\-.]{1,64}$/.test(id))
    throw new AppError(400, 'Invalid FHIR resource ID.'); return id; };
export async function records(sessionId: string, id: string) {
    fhirId(id);
    const patient = await fhir(sessionId, 'Patient/' + id) as FhirResource;
    const results: ResourceResult[] = await Promise.all(resourceTypes.map(async (resourceType) => { try {
        const data = await fhir(sessionId, resourceType + '?patient=' + encodeURIComponent(id) + '&_count=50') as Bundle;
        const resources = data.entry?.flatMap(e => e.resource ? [e.resource] : []) || [];
        return { resourceType, status: resources.length ? 'available' : 'empty', resources, message: data.link?.some(l => l.relation === 'next') ? 'Partial result: additional pages exist. Refine your selection in Epic.' : undefined } as ResourceResult;
    }
    catch (e) {
        if (e instanceof AppError && e.status === 401)
            throw e;
        return { resourceType, status: e instanceof AppError && e.status === 403 ? 'denied' : e instanceof AppError && [400, 404, 405, 501].includes(e.status) ? 'unsupported' : 'error', resources: [], message: e instanceof AppError ? e.message : 'Resource request failed.' } as ResourceResult;
    } }));
    return normalize(epicConfig().base, patient, results);
}
export async function referencedBinary(sessionId: string, patientId: string, documentId: string) {
    const chart = await records(sessionId, patientId);
    const doc = chart.results.find(r => r.resourceType === 'DocumentReference')?.resources.find(r => r.id === documentId);
    if (!doc)
        throw new AppError(404, 'Document is not among this patient’s authorized references.');
    const attachments = doc.content as {
        attachment?: {
            url?: string;
        };
    }[] | undefined;
    const url = attachments?.[0]?.attachment?.url;
    const base = epicConfig().base + '/';
    const relative = url?.startsWith(base) ? url.slice(base.length) : url;
    if (!relative || !/^Binary\/[A-Za-z0-9\-.]{1,64}$/.test(relative))
        throw new AppError(422, 'This document has no supported authorized Binary reference.');
    return fhir(sessionId, relative);
}
