import type { FhirResource, NormalizedChart, ResourceResult } from './types';
export function normalize(issuer: string, patient: FhirResource, results: ResourceResult[], encounterId?: string): NormalizedChart {
    const names = patient.name as {
        given?: string[];
        family?: string;
        text?: string;
    }[] | undefined;
    const displayName = names?.[0]?.text || [...(names?.[0]?.given || []), names?.[0]?.family].filter(Boolean).join(' ') || 'Synthetic Epic patient';
    if (patient.resourceType !== 'Patient' || !patient.id)
        throw new Error('Expected a FHIR Patient with an ID.');
    return { issuer, patientId: patient.id, displayName, encounterId, finalizedAvsRetrieved: false, results };
}
