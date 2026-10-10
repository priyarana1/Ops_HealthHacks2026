import { afterEach,describe,it,expect,vi } from 'vitest';
const sdk=vi.hoisted(()=>({stream:vi.fn(),responses:vi.fn()}));
vi.mock('@anthropic-ai/sdk',()=>({default:class{beta={messages:{stream:sdk.stream}};}}));
vi.mock('openai',()=>({default:class{responses={create:sdk.responses};}}));
import { modelClient,jsonText } from '../src/lib/backend/llm';
afterEach(()=>{vi.unstubAllEnvs();sdk.stream.mockReset();sdk.responses.mockReset();});
const reply=(message:object)=>sdk.stream.mockReturnValue({finalMessage:async()=>message});
const request={system:[{text:'Rules'}],messages:[{role:'user' as const,content:[{text:'Source'}]},{role:'assistant' as const,content:[{text:'{}'}]},{role:'user' as const,content:[{text:'Fix it'}]}],inferenceConfig:{temperature:0,maxTokens:10000}};
describe('Model provider switch',()=>{
 it('uses the Anthropic API when ANTHROPIC_API_KEY is set, without temperature',async()=>{
  vi.stubEnv('ANTHROPIC_API_KEY','test-key');reply({id:'msg_1',stop_reason:'end_turn',content:[{type:'thinking',thinking:''},{type:'text',text:'{"ok":true}'}]});
  const client=modelClient();expect(client.modelId).toBe('claude-opus-5-5');
  const result=await client.send(request);
  expect(result.output?.message?.content).toEqual([{text:'{"ok":true}'}]);
  const sent=sdk.stream.mock.calls[0][0];
  expect(sent).toMatchObject({model:'claude-opus-5-5',system:'Rules',fallbacks:'default',messages:[{role:'user',content:'Source'},{role:'assistant',content:'{}'},{role:'user',content:'Fix it'}]});
  expect(sent).not.toHaveProperty('temperature');
 });
 it('treats a declined request as an error instead of empty output',async()=>{vi.stubEnv('ANTHROPIC_API_KEY','test-key');reply({id:'msg_2',stop_reason:'refusal',content:[]});await expect(modelClient().send(request)).rejects.toThrow('declined');});
 it('uses the OpenAI API in JSON mode when only OPENAI_API_KEY is set',async()=>{
  vi.stubEnv('ANTHROPIC_API_KEY','');vi.stubEnv('OPENAI_API_KEY','test-key');vi.stubEnv('OPENAI_MODEL','test-openai-model');
  sdk.responses.mockResolvedValue({id:'resp_1',status:'completed',incomplete_details:null,output_text:'{"ok":true}'});
  const client=modelClient();expect(client.region).toBe('openai-api');
  expect((await client.send(request)).output?.message?.content).toEqual([{text:'{"ok":true}'}]);
  const sent=sdk.responses.mock.calls[0][0];
  expect(sent).toMatchObject({model:'test-openai-model',text:{format:{type:'json_object'}},input:[{role:'developer',content:'Rules'},{role:'user',content:'Source'},{role:'assistant',content:'{}'},{role:'user',content:'Fix it'}]});
  expect(sent).not.toHaveProperty('temperature');expect(sent).not.toHaveProperty('reasoning');
 });
 it('reports truncated OpenAI output and requires a model name',async()=>{
  vi.stubEnv('ANTHROPIC_API_KEY','');vi.stubEnv('OPENAI_API_KEY','test-key');vi.stubEnv('OPENAI_MODEL','');expect(()=>modelClient()).toThrow('OPENAI_MODEL');
  vi.stubEnv('OPENAI_MODEL','test-openai-model');sdk.responses.mockResolvedValue({id:'resp_2',status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output_text:'{"a":'});
  expect((await modelClient().send(request)).stopReason).toBe('max_tokens');
 });
 it('falls back to Bedrock configuration when no Anthropic or OpenAI key is set',()=>{vi.stubEnv('ANTHROPIC_API_KEY','');vi.stubEnv('OPENAI_API_KEY','');vi.stubEnv('BEDROCK_MODEL_ID','');expect(()=>modelClient()).toThrow('Configure');});
});
describe('JSON extraction',()=>{
 it('reads JSON wrapped in prose or code fences',()=>{expect(JSON.parse(jsonText('Here is the result:\n```json\n{"a":{"b":1}}\n```\nDone.'))).toEqual({a:{b:1}});});
 it('leaves text without an object unchanged so parsing still fails clearly',()=>expect(jsonText('not JSON')).toBe('not JSON'));
});
