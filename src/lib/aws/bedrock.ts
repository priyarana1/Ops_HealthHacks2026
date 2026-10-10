import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { ZodError } from 'zod';
import { planContent, validateEvidence, flagMissingMedicationDetails } from '@/lib/ai/schemas';
import { runSafetyChecks } from '@/lib/ai/checks';
import { systemPrompt, schemaDescription } from '@/lib/ai/prompts';
import { AppError } from '@/lib/security/core';
export async function processClinical(source: string) {
    if (!process.env.BEDROCK_MODEL_ID)
        throw new AppError(503, 'BEDROCK_MODEL_ID is missing. Use the explicitly labeled demo action or configure Bedrock.');
    const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION, maxAttempts: 3 });
    let last = '';
    for (let attempt = 0; attempt < 2; attempt++) {
        const response = await client.send(new ConverseCommand({ modelId: process.env.BEDROCK_MODEL_ID, system: [{ text: systemPrompt }], messages: [{ role: 'user', content: [{ text: JSON.stringify({ schema: schemaDescription, clinicalSource: source, validationFeedback: last }) }] }], inferenceConfig: { temperature: 0, maxTokens: 16000 } }));
        try {
            if (response.stopReason === 'max_tokens')
                throw new Error('Output was cut off before the JSON finished. Keep explanations short.');
            const text = response.output?.message?.content?.map((c: {
                text?: string;
            }) => c.text || '').join('') || '';
            const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
            const parsed = planContent.parse(JSON.parse(json));
            validateEvidence(parsed, source);
            return runSafetyChecks(flagMissingMedicationDetails(parsed), source);
        }
        catch (e) {
            const detail = e instanceof ZodError ? e.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : e instanceof Error ? e.message : 'unknown error';
            last = `Previous output failed validation (${detail}). Correct it without guessing missing values.`;
        }
    }
    throw new AppError(422, 'AI output failed validation twice. Review source and retry; no draft was saved.');
}
