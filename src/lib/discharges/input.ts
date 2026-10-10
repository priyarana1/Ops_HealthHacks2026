import { z } from 'zod';
export const dischargeInput = z.object({
 displayName:z.string().trim().min(1).max(100),
 clinicalInput:z.string().max(60000).default(''),
 uploadedChartText:z.string().max(60000).default(''),
 syntheticConfirmed:z.literal(true),
 epicPatientId:z.string().optional(),encounterId:z.string().optional(),demo:z.boolean().default(false),
}).strict().superRefine((data,ctx)=>{
 if(!data.demo && !data.epicPatientId && !data.clinicalInput.trim() && !data.uploadedChartText.trim())ctx.addIssue({code:z.ZodIssueCode.custom,message:'Provide synthetic chart context or finalized AVS text before saving.'});
 if(data.demo && (data.uploadedChartText.trim() || data.epicPatientId || data.encounterId))ctx.addIssue({code:z.ZodIssueCode.custom,message:'The built-in demo cannot be combined with a different chart.'});
});
