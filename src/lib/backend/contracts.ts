import { z } from 'zod';
export const states=['DRAFT','PROCESSING','PENDING_REVIEW','APPROVED','ACCESS_GRANTED','ACTIVE','REVOKED','EXPIRED'] as const;
export const stateSchema=z.enum(states);
export const evidence=z.object({sourceId:z.string().uuid(),quote:z.string().min(1).max(20000)}).strict();
export const instruction=z.object({text:z.string().min(1).max(4000),evidence}).strict();
export const medication=z.object({name:z.string().min(1),dose:z.string().nullable(),route:z.string().nullable(),frequency:z.string().nullable(),duration:z.string().nullable(),formulation:z.string().nullable(),status:z.enum(['NEW','CONTINUE','CHANGE','STOP','HOLD']),notes:z.string(),plainLanguage:z.string(),evidence}).strict();
export const issue=z.object({id:z.string().min(1),severity:z.enum(['critical','warning']),description:z.string().min(1),resolution:z.string().nullable()}).strict();
export const generatedContent=z.object({language:z.literal('en'),summary:instruction.nullable(),hospitalCourse:z.array(instruction),diagnoses:z.array(instruction),medications:z.array(medication),dailyActions:z.array(instruction),diet:z.array(instruction),fluids:z.array(instruction),activity:z.array(instruction),otherInstructions:z.array(instruction),appointments:z.array(instruction),labsAndMonitoring:z.array(instruction),warningSigns:z.array(z.object({text:z.string(),level:z.enum(['CONTACT_CARE_TEAM','URGENT','EMERGENCY']),evidence}).strict()),definitions:z.array(z.object({term:z.string(),meaning:z.string(),evidence}).strict()),teachBackQuestions:z.array(instruction),practicalBarriers:z.array(instruction),issues:z.array(issue)}).strict();
export type GeneratedContent=z.infer<typeof generatedContent>;
export const sourceKind=z.enum(['FINAL_AVS','DISCHARGE_SUMMARY','CHART_CONTEXT','CLINICIAN_NOTE','AUDIO_TRANSCRIPT','EPIC_FHIR']);
export const createEpisode=z.object({requestId:z.string().uuid(),syntheticConfirmed:z.literal(true),patient:z.object({displayName:z.string().trim().min(1).max(100),dateOfBirth:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).strict(),dischargeAt:z.string(),dischargeTimezone:z.string().min(1).max(80),dischargeConfirmed:z.boolean().default(false),clinicalInput:z.string().max(120000).optional(),sourceKind:sourceKind.default('FINAL_AVS'),epicPatientId:z.string().optional(),encounterId:z.string().optional()}).strict();
export const sourceInput=z.object({requestId:z.string().uuid(),kind:sourceKind,text:z.string().trim().min(1).max(120000),transcriptConfirmed:z.boolean().default(false)}).strict();
export const reviewInput=z.object({version:z.number().int().positive(),content:generatedContent.optional(),dischargeConfirmed:z.boolean().optional(),resolutions:z.array(z.object({id:z.string(),resolution:z.string().trim().min(1).max(4000)}).strict()).optional()}).strict();
export const approveInput=z.object({version:z.number().int().positive(),clinicalReviewConfirmed:z.literal(true)}).strict();
export const grantInput=z.object({version:z.number().int().positive(),email:z.string().email().max(254).transform(v=>v.toLowerCase()),enrollmentAuthorized:z.literal(true)}).strict();
export const activationInput=z.object({token:z.string().min(40).max(100),activationCode:z.string().regex(/^\d{8}$/),password:z.string().min(12).max(128).refine(v=>new TextEncoder().encode(v).length<=72,'Password must be at most 72 UTF-8 bytes')}).strict();
export const loginInput=z.object({email:z.string().email().max(254).transform(v=>v.toLowerCase()),password:z.string().min(1).max(128)}).strict();
export interface EpisodeReference {episodeId:string;planId:string;patientId:string;dischargeAt:string;dischargeTimezone:string;expiresAt:string;state:z.infer<typeof stateSchema>;version:number}
export interface PatientPlanResponse extends EpisodeReference {content:GeneratedContent;approvedVersion:number;language:'en'}
export interface ApiFailure {error:string}
export type SourceProvenance={sourceId:string;kind:z.infer<typeof sourceKind>;text:string;createdAt:Date;documentType:string;transcriptConfirmed:boolean};

export interface NormalizedClinicalData {
 patient:{patientId:string;displayName:string;dateOfBirth?:string};
 provider:{providerId:string};episode:EpisodeReference;
 encounter?:{issuer:string;patientId:string;encounterId?:string};
 sources:SourceProvenance[];
 extractionStatus:'AWAITING_EXTRACTION'|'STRUCTURED_REQUIRES_REVIEW';
 clinical?:GeneratedContent;
}
// Future translations are separate reviewed artifacts; never replace approved English automatically.
export interface TranslationContract {language:string;basedOnPlanVersion:number;reviewStatus:'DRAFT'|'PENDING_REVIEW'|'APPROVED';approvedBy?:string;approvedAt?:string}
