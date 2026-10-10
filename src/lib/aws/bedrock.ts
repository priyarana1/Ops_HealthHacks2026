import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { planContent, validateEvidence, flagMissingMedicationDetails } from '@/lib/ai/schemas';
import { systemPrompt, schemaDescription } from '@/lib/ai/prompts';
import { AppError } from '@/lib/security/core';
export async function processClinical(source: string) {
    if (!process.env.BEDROCK_MODEL_ID)
        throw new AppError(503, 'BEDROCK_MODEL_ID is missing. Use the explicitly labeled demo action or configure Bedrock.');
    const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION, maxAttempts: 3 });
    let last = '';
    for (let attempt = 0; attempt < 2; attempt++) {
        const response = await client.send(new ConverseCommand({ modelId: process.env.BEDROCK_MODEL_ID, system: [{ text: systemPrompt }], messages: [{ role: 'user', content: [{ text: JSON.stringify({ schema: schemaDescription, clinicalSource: source, validationFeedback: last }) }] }], inferenceConfig: { temperature: 0, maxTokens: 6000 } }));
        try {
            const text = response.output?.message?.content?.map((c: {
                text?: string;
            }) => c.text || '').join('') || '';
            const parsed = planContent.parse(JSON.parse(text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')));
            validateEvidence(parsed, source);
            return flagMissingMedicationDetails(parsed);
        }
        catch {
            last = 'Previous output failed JSON, schema, or exact source-evidence validation. Correct it without guessing missing values.';
        }
    }
    throw new AppError(422, 'AI output failed validation twice. Review source and retry; no draft was saved.');
}
