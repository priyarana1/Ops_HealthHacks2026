import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { ReasoningEffort } from 'openai/resources/shared';
import { BedrockRuntimeClient,ConverseCommand,type ConverseCommandInput } from '@aws-sdk/client-bedrock-runtime';
import { AppError } from '@/lib/security/core';
// One model call shape for the clinical pipeline, chosen by which credentials are set, in order:
// ANTHROPIC_API_KEY (ANTHROPIC_MODEL, default claude-opus-5-5), OPENAI_API_KEY (OPENAI_MODEL), else Amazon Bedrock.
export interface ModelReply {output?:{message?:{content?:{text?:string}[]}};stopReason?:string;$metadata?:{requestId?:string}}
export interface ModelClient {modelId:string;region:string;send(input:Omit<ConverseCommandInput,'modelId'>):Promise<ModelReply>}
export function modelClient():ModelClient{
 if(process.env.ANTHROPIC_API_KEY){
  const modelId=process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',client=new Anthropic({maxRetries:3});
  return {modelId,region:'anthropic-api',async send(input){
   // Opus 5.5 always thinks and rejects temperature, so inferenceConfig is not forwarded. Effort controls depth.
   const message=await client.beta.messages.stream({
    model:modelId,max_tokens:32000,
    system:(input.system || []).map(s=>s.text || '').join('\n'),
    messages:(input.messages || []).map(m=>({role:m.role as 'user'|'assistant',content:(m.content || []).map(c=>c.text || '').join('')})),
    output_config:{effort:(process.env.ANTHROPIC_EFFORT as 'low'|'medium'|'high') || 'medium'},
    // If a safety classifier declines, the API retries on a suitable fallback model in the same call.
    betas:['server-side-fallback-2026-07-01'],fallbacks:'default',
   }).finalMessage();
   if(message.stop_reason==='refusal')throw new AppError(422,'The model declined to process this document.');
   return {output:{message:{content:message.content.flatMap(b=>b.type==='text'?[{text:b.text}]:[])}},stopReason:message.stop_reason ?? undefined,$metadata:{requestId:message.id}};
  }};
 }
 if(process.env.OPENAI_API_KEY){
  const modelId=process.env.OPENAI_MODEL;
  if(!modelId)throw new AppError(503,'Set OPENAI_MODEL to the OpenAI model to use. No synthetic AI result was substituted.');
  const client=new OpenAI({maxRetries:3}),effort=process.env.OPENAI_REASONING_EFFORT as ReasoningEffort | undefined;
  return {modelId,region:'openai-api',async send(input){
   // Reasoning models reject temperature, so inferenceConfig is not forwarded. JSON mode guarantees parseable output.
   const response=await client.responses.create({
    model:modelId,max_output_tokens:32000,text:{format:{type:'json_object'}},...(effort?{reasoning:{effort}}:{}),
    // JSON mode requires "JSON" in the input messages, so the rules go in a developer message, not instructions.
    input:[{role:'developer' as const,content:(input.system || []).map(s=>s.text || '').join('\n')},...(input.messages || []).map(m=>({role:m.role as 'user'|'assistant',content:(m.content || []).map(c=>c.text || '').join('')}))],
   });
   if(response.incomplete_details?.reason==='content_filter')throw new AppError(422,'The model declined to process this document.');
   return {output:{message:{content:[{text:response.output_text}]}},stopReason:response.incomplete_details?.reason==='max_output_tokens'?'max_tokens':response.status,$metadata:{requestId:response.id}};
  }};
 }
 const modelId=process.env.BEDROCK_MODEL_ID,region=process.env.AWS_REGION;
 if(!modelId || !region)throw new AppError(503,'Configure ANTHROPIC_API_KEY, OPENAI_API_KEY, or BEDROCK_MODEL_ID and AWS_REGION, before processing. No synthetic AI result was substituted.');
 const client=new BedrockRuntimeClient({region,maxAttempts:3});
 return {modelId,region,send:input=>client.send(new ConverseCommand({...input,modelId}))};
}
// Models sometimes wrap the JSON in a sentence or code fence; parse only the outermost object.
export function jsonText(raw:string){const start=raw.indexOf('{'),end=raw.lastIndexOf('}');return start>=0 && end>start?raw.slice(start,end+1):raw;}
