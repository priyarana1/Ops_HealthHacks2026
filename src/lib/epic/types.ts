export interface FhirResource {
    resourceType: string;
    id?: string;
    [key: string]: unknown;
}
export interface Bundle extends FhirResource {
    entry?: {
        resource?: FhirResource;
    }[];
    link?: {
        relation: string;
        url: string;
    }[];
}
export interface ResourceResult {
    resourceType: string;
    status: 'available' | 'empty' | 'unsupported' | 'denied' | 'error';
    resources: FhirResource[];
    message?: string;
}
export interface NormalizedChart {
    issuer: string;
    patientId: string;
    displayName: string;
    encounterId?: string;
    finalizedAvsRetrieved: false;
    results: ResourceResult[];
}
