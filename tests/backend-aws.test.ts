import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
const mocked=vi.hoisted(()=>({send:vi.fn(),load:vi.fn()}));
vi.mock('@aws-sdk/client-bedrock-runtime',()=>({BedrockRuntimeClient:class{send=mocked.send;},ConverseCommand:class{constructor(public input:unknown){}}}));
vi.mock('../src/lib/backend/dependencies',()=>({optionalDependency:mocked.load}));
import { clinicalProcessor } from '../src/lib/backend/bedrock';
import { emailDelivery } from '../src/lib/backend/email';
beforeEach(()=>{vi.stubEnv('AWS_REGION','us-east-1');vi.stubEnv('BEDROCK_MODEL_ID','synthetic-test-model');vi.stubEnv('SES_FROM_EMAIL','verified-test@example.com');mocked.send.mockReset();mocked.load.mockReset();});
afterEach(()=>vi.unstubAllEnvs());
describe('AWS adapters with explicit service doubles',()=>{
 it('fails clearly for missing Bedrock configuration and service failure',async()=>{vi.stubEnv('BEDROCK_MODEL_ID','');await expect(clinicalProcessor.process([])).rejects.toThrow('Configure');vi.stubEnv('BEDROCK_MODEL_ID','synthetic-test-model');mocked.send.mockRejectedValue(new Error('AWS denied'));await expect(clinicalProcessor.process([])).rejects.toThrow('Bedrock request failed');});
 it('bounds invalid JSON retries and never produces a fallback clinical plan',async()=>{mocked.send.mockResolvedValue({output:{message:{content:[{text:'not JSON'}]}}});await expect(clinicalProcessor.process([])).rejects.toThrow('failed clinical validation twice');expect(mocked.send).toHaveBeenCalledTimes(2);});
 it('supplies an explicit schema and retries with safe field-level feedback',async()=>{
  const valid={language:'en',summary:null,hospitalCourse:[],diagnoses:[],medications:[],dailyActions:[],diet:[],fluids:[],activity:[],otherInstructions:[],appointments:[],labsAndMonitoring:[],warningSigns:[],definitions:[],teachBackQuestions:[],practicalBarriers:[],issues:[]};
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  try{
   mocked.send.mockResolvedValueOnce({output:{message:{content:[{text:JSON.stringify({...valid,teachBackQuestions:['PRIVATE_INVALID_TEXT']})}]}}}).mockResolvedValueOnce({output:{message:{content:[{text:JSON.stringify(valid)}]}}});
   const result=await clinicalProcessor.process([]);
   expect(result.content.language).toBe('en');
   const first=JSON.parse(mocked.send.mock.calls[0][0].input.messages[0].content[0].text);
   expect(first.schema.properties.medications.items.properties.status.enum).toContain('HOLD');
   expect(first.schema.properties.teachBackQuestions.items.required).toEqual(['text','evidence']);
   const second=mocked.send.mock.calls[1][0].input.messages[0].content[0].text;
   expect(second).toContain('teachBackQuestions.0 (invalid_type)');
   expect(JSON.stringify(warn.mock.calls)).not.toContain('PRIVATE_INVALID_TEXT');
  }finally{warn.mockRestore();}
 });
 it('fails closed when SES is unconfigured or rejects mail',async()=>{vi.stubEnv('SES_FROM_EMAIL','');await expect(emailDelivery.sendInvitation({to:'synthetic@example.com',activationUrl:'https://example.com/#token=synthetic',validUntil:new Date()})).rejects.toThrow('Configure');vi.stubEnv('SES_FROM_EMAIL','verified-test@example.com');mocked.load.mockReturnValue({SESv2Client:class{async send(){throw new Error('Denied');}},SendEmailCommand:class{constructor(public input:unknown){}}});await expect(emailDelivery.sendInvitation({to:'synthetic@example.com',activationUrl:'https://example.com/#token=synthetic',validUntil:new Date()})).rejects.toThrow('email delivery failed');});
 it('sends a non-clinical invitation and requires SES acceptance',async()=>{const send=vi.fn(async()=>({MessageId:'synthetic-service-fixture'}));mocked.load.mockReturnValue({SESv2Client:class{send=send;},SendEmailCommand:class{constructor(public input:unknown){}}});await emailDelivery.sendInvitation({to:'synthetic@example.com',activationUrl:'https://example.com/#token=synthetic',validUntil:new Date()});const input=send.mock.calls[0] as unknown as [{input:Record<string,unknown>}];expect(JSON.stringify(input)).toContain('Your ClearPath invitation');expect(JSON.stringify(input)).not.toContain('heart failure');});
});
