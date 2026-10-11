import { describe,it,expect,vi,beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { memoryDatabase } from './fixtures/backend-memory';
const doubles=vi.hoisted(()=>({llm:vi.fn(),process:vi.fn(),send:vi.fn(),cookie:{} as {token?:string;save:()=>Promise<void>;destroy:()=>void},tables:undefined as unknown,models:{} as Record<string,unknown>}));
vi.mock('../src/lib/backend/models',async()=>{const {memoryDatabase}=await import('./fixtures/backend-memory');const memory=memoryDatabase();doubles.tables=memory.tables;for(const name of ['TranslationModel','EpisodeModel','PatientReferenceModel','ClinicalPlanModel','SourceModel','ApprovalModel','InvitationModel','AccountModel','PatientSessionModel','ObjectManifestModel'])doubles.models[name]=memory.model(name);return doubles.models;});
vi.mock('../src/lib/db/mongodb',()=>({connectDB:vi.fn()}));
vi.mock('../src/lib/backend/llm',async()=>({...await vi.importActual('../src/lib/backend/llm'),modelClient:()=>({modelId:'SYNTHETIC-TEST-DOUBLE',region:'test',send:doubles.llm})}));
vi.mock('../src/lib/backend/repository',async()=>({...await vi.importActual('../src/lib/backend/repository'),transaction:async(fn:(s:unknown)=>Promise<unknown>)=>fn({})}));
vi.mock('../src/lib/backend/bedrock',()=>({clinicalProcessor:{process:doubles.process}}));vi.mock('../src/lib/backend/email',()=>({emailDelivery:{sendInvitation:doubles.send}}));
vi.mock('../src/lib/auth/session',()=>({identity:async()=>({identity:'synthetic-provider',sessionHash:'synthetic-provider-session',isAdmin:true})}));
vi.mock('../src/lib/db/models',()=>({RateLimit:{findOneAndUpdate:async()=>({count:1})}}));
vi.mock('iron-session',()=>({getIronSession:async()=>doubles.cookie}));vi.mock('next/headers',()=>({cookies:async()=>({})}));
import { providerBackend,patientBackend } from '../src/lib/backend/http';
import { generatedContent } from '../src/lib/backend/contracts';
const tables=()=>doubles.tables as ReturnType<typeof memoryDatabase>['tables'];
const req=(path:string,method='GET',body?:unknown)=>new NextRequest('http://localhost:3000/api/'+path,{method,headers:{origin:'http://localhost:3000','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
async function call(path:string,method='GET',body?:unknown){const response=await (path.startsWith('patient/')?patientBackend:providerBackend)(req(path,method,body));return {status:response.status,body:await response.json()};}
beforeEach(()=>{for(const rows of tables().values())rows.splice(0);vi.stubEnv('APP_URL','http://localhost:3000');vi.stubEnv('NODE_ENV','test');vi.stubEnv('AWS_S3_BUCKET','');doubles.send.mockReset().mockResolvedValue(undefined);doubles.process.mockReset();doubles.cookie={save:async()=>{},destroy:()=>{delete doubles.cookie.token;}};});
async function draft(){return (await call('discharges','POST',{requestId:'12345678-1234-4234-8234-123456789012',syntheticConfirmed:true,patient:{displayName:'Synthetic HF Example'},dischargeAt:new Date(Date.now()-86400000).toISOString(),dischargeTimezone:'UTC',dischargeConfirmed:true,clinicalInput:'Weigh daily.',sourceKind:'FINAL_AVS'})).body;}
function generated(){const source=tables().get('SourceModel')![0];return generatedContent.parse({language:'en',summary:null,hospitalCourse:[],diagnoses:[],medications:[],dailyActions:[{text:'Weigh daily.',evidence:{sourceId:source.sourceId,quote:'Weigh daily.'}}],diet:[],fluids:[],activity:[],otherInstructions:[],appointments:[],labsAndMonitoring:[],warningSigns:[],definitions:[],teachBackQuestions:[],practicalBarriers:[],issues:[{id:'source-completeness',severity:'critical',description:'Review all sources',resolution:null}]});}
async function approved(){const d=await draft();doubles.process.mockResolvedValue({content:generated(),model:{modelId:'SYNTHETIC-TEST-DOUBLE',region:'test',generatedAt:new Date()}});await call(`discharges/${d.planId}/process`,'POST',{});await call(`discharges/${d.planId}/review`,'PATCH',{version:2,resolutions:[{id:'source-completeness',resolution:'Synthetic test fixture reviewed.'}]});expect((await call(`discharges/${d.planId}/approve`,'POST',{version:3,clinicalReviewConfirmed:true})).status).toBe(200);return {...d,version:3};}
describe('Backend orchestration — test doubles only, no live MongoDB/AWS/email',()=>{
 it('keeps source and extraction when the later simplification service fails',async()=>{
  const d=await draft(),extraction=generated(),model={modelId:'SYNTHETIC-TEST-DOUBLE',region:'test',generatedAt:new Date()};
  doubles.process.mockImplementation(async(_sources,saveExtraction)=>{await saveExtraction(extraction,model);throw new Error('Synthetic stage-two failure');});
  expect((await call(`discharges/${d.planId}/process`,'POST',{})).status).toBe(503);
  expect(tables().get('ClinicalPlanModel')![0].extraction).toEqual(extraction);
  expect(tables().get('ClinicalPlanModel')![0].content).toBeUndefined();
  expect(tables().get('SourceModel')![0].text).toBe('Weigh daily.');
  expect(tables().get('EpisodeModel')![0].state).toBe('DRAFT');
  const source=tables().get('SourceModel')![0];
  expect((await call(`discharges/${d.planId}/sources`,'PATCH',{version:1,sourceId:source.sourceId,text:'New synthetic source text.',transcriptConfirmed:false})).status).toBe(200);
  expect(tables().get('ClinicalPlanModel')![0].extraction).toBeUndefined();
 });
 it('denies enrollment before approval and denies approval with unresolved issues',async()=>{const d=await draft();expect((await call(`discharges/${d.planId}/grant-access`,'POST',{version:1,email:'synthetic@example.com',enrollmentAuthorized:true})).status).toBe(409);expect(doubles.send).not.toHaveBeenCalled();doubles.process.mockResolvedValue({content:generated(),model:{modelId:'test'}});await call(`discharges/${d.planId}/process`,'POST',{});expect((await call(`discharges/${d.planId}/approve`,'POST',{version:2,clinicalReviewConfirmed:true})).status).toBe(422);});
 it('publishes a secure link and 6-digit code, signs in with the code, and revokes old links on reissue',async()=>{
  const d=await approved(),pub=await call(`discharges/${d.planId}/publish`,'POST',{});expect(pub.status).toBe(200);expect(pub.body.code).toMatch(/^\d{6}$/);
  const token=pub.body.link.split('/p/')[1];expect(tables().get('InvitationModel')![0].tokenHash).not.toBe(token);expect(JSON.stringify(tables().get('InvitationModel'))).not.toContain(pub.body.code);
  expect((await call('patient/link','POST',{token})).body).toEqual({status:'code_required',triesLeft:5});
  expect((await call('patient/discharge-plan')).status).toBe(401);
  const wrong=pub.body.code==='000000'?'111111':'000000';expect((await call('patient/link/verify','POST',{token,code:wrong})).body).toEqual({verified:false,triesLeft:4});
  expect((await call('patient/link/verify','POST',{token,code:pub.body.code})).body.verified).toBe(true);
  expect(tables().get('InvitationModel')![0].attempts).toBe(0);
  const plan=await call('patient/discharge-plan');expect(plan.status).toBe(200);expect(plan.body.planId).toBe(d.planId);expect(plan.body.displayName).toBe('Synthetic HF Example');
  expect((await call('patient/link','POST',{token})).body).toEqual({status:'signed_in'});
  const again=await call(`discharges/${d.planId}/publish`,'POST',{});expect(again.status).toBe(200);
  expect((await call('patient/link','POST',{token})).body).toEqual({status:'unavailable'});expect((await call('patient/discharge-plan')).status).toBe(401);
  expect((await call('patient/link','POST',{token:again.body.link.split('/p/')[1]})).body.status).toBe('code_required');
 });
 it('refuses to publish a patient link before clinician approval',async()=>{const d=await draft();expect((await call(`discharges/${d.planId}/publish`,'POST',{})).status).toBe(409);expect(tables().get('InvitationModel')).toEqual([]);});
 it('locks a link after 5 wrong codes, even for the right code',async()=>{
  const a=await approved(),pub=await call(`discharges/${a.planId}/publish`,'POST',{}),token=pub.body.link.split('/p/')[1],wrong=pub.body.code==='000000'?'111111':'000000';
  for(let i=0;i<5;i++)await call('patient/link/verify','POST',{token,code:wrong});
  expect((await call('patient/link/verify','POST',{token,code:pub.body.code})).body).toEqual({verified:false,triesLeft:0});
  expect((await call('patient/link','POST',{token})).body).toEqual({status:'locked'});
 });
 it('translates the approved plan, blocks a meaning change, accepts an edit, publishes, and serves it to the patient',async()=>{
  // Scripted stand-in for the AI: Spanish-looking text, a literal back-translation, and one injected mismatch.
  let mismatch=true;
  const reply=(json:unknown)=>({output:{message:{content:[{text:JSON.stringify(json)}]}}});
  doubles.llm.mockImplementation(async(input:{system:{text:string}[];messages:{content:{text:string}[]}[]})=>{
   const system=input.system[0].text,payload=JSON.parse(input.messages[0].content[0].text);
   if(system.includes('You translate'))return reply({translations:payload.fields.map((f:{path:string;text:string})=>({path:f.path,text:'ES '+f.text}))});
   if(system.includes('back into English'))return reply({backTranslations:payload.texts.map((t:{path:string;text:string})=>({path:t.path,text:t.text.replace(/^ES /,'')}))});
   return reply({mismatches:mismatch?[{path:payload.items[0].path,problem:'The timing changed.'}]:[]});
  });
  const d=await approved();
  expect((await call(`discharges/${d.planId}/translations/xx`,'POST')).status).toBe(400);
  const es=await call(`discharges/${d.planId}/translations/es`,'POST');expect(es.status).toBe(200);expect(es.body.status).toBe('blocked');
  expect(es.body.fields[0]).toMatchObject({path:'dailyActions.0.text',source:'Weigh daily.',text:'ES Weigh daily.',backTranslation:'Weigh daily.',problems:['The timing changed.']});
  expect((await call(`discharges/${d.planId}/translations/es/publish`,'POST')).status).toBe(422);
  mismatch=false;
  const edited=await call(`discharges/${d.planId}/translations/es`,'PATCH',{path:'dailyActions.0.text',text:'ES Pésese cada día.'});expect(edited.body.status).toBe('verified');
  const published=await call(`discharges/${d.planId}/translations/es/publish`,'POST');expect(published.body).toMatchObject({status:'published',publishedBy:'synthetic-provider',current:true});
  expect((tables().get('ClinicalPlanModel')![0].translations as Record<string,{content:{dailyActions:{text:string}[]}}>).es.content.dailyActions[0].text).toBe('ES Pésese cada día.');
  expect((await call(`discharges/${d.planId}/translations`)).body.translations.map((t:{language:string;status:string})=>[t.language,t.status])).toEqual([['es','published']]);
  const pub=await call(`discharges/${d.planId}/publish`,'POST',{}),token=pub.body.link.split('/p/')[1];
  await call('patient/link/verify','POST',{token,code:pub.body.code});
  const plan=await call('patient/discharge-plan');expect(plan.body.content.dailyActions[0].text).toBe('Weigh daily.');expect(plan.body.translations.es.dailyActions[0].text).toBe('ES Pésese cada día.');
 });
 it('approves, grants, activates once, logs in, retrieves only its plan, and denies access after expiry',async()=>{
  const d=await approved(),grant=await call(`discharges/${d.planId}/grant-access`,'POST',{version:3,email:'synthetic@example.com',enrollmentAuthorized:true});expect(grant.status).toBe(200);const sent=doubles.send.mock.calls[0][0],token=new URL(sent.activationUrl).hash.slice('#token='.length);const activation={token,activationCode:grant.body.activationCode,password:'Synthetic-test-password-123'};
  expect((await call('patient/activate','POST',{...activation,activationCode:'00000000'})).status).toBe(401);expect((await call('patient/activate','POST',activation)).status).toBe(200);expect((await call('patient/activate','POST',activation)).status).toBe(401);
  expect((await call('patient/login','POST',{email:'synthetic@example.com',password:'wrong'})).status).toBe(401);expect((await call('patient/login','POST',{email:'synthetic@example.com',password:activation.password})).status).toBe(200);const plan=await call('patient/discharge-plan');expect(plan.status).toBe(200);expect(plan.body.planId).toBe(d.planId);const account=tables().get('AccountModel')![0],originalPatientId=account.patientId;account.patientId='different-patient';expect((await call('patient/discharge-plan')).status).toBe(401);account.patientId=originalPatientId;const ep=tables().get('EpisodeModel')![0];ep.owner='different-provider';expect((await call(`discharges/${d.planId}`)).status).toBe(404);ep.owner='synthetic-provider';
  tables().get('EpisodeModel')![0].expiresAt=new Date(0);expect((await call('patient/discharge-plan')).status).toBe(401);
 });
 it('revokes accounts and invitations and prevents cross-patient ownership disclosure',async()=>{const d=await approved();await call(`discharges/${d.planId}/grant-access`,'POST',{version:3,email:'synthetic@example.com',enrollmentAuthorized:true});const token=new URL(doubles.send.mock.calls[0][0].activationUrl).hash.slice(7),code=tables().get('InvitationModel')![0];expect(code.state).toBe('SENT');await call(`discharges/${d.planId}/revoke`,'POST',{});expect(tables().get('InvitationModel')![0].state).toBe('REVOKED');expect((await call('patient/activate','POST',{token,activationCode:'12345678',password:'Synthetic-password-123'})).status).toBe(401);expect((await call('patient/discharge-plan')).status).toBe(401);});
 it('reuses an identical create request and rejects an idempotency key with changed data',async()=>{const payload={requestId:'12345678-1234-4234-8234-123456789099',syntheticConfirmed:true,patient:{displayName:'Synthetic Retry'},dischargeAt:new Date(Date.now()-86400000).toISOString(),dischargeTimezone:'UTC',clinicalInput:'Weigh daily.'};const first=await call('discharges','POST',payload),second=await call('discharges','POST',payload);expect(first.body.patientId).toBe(second.body.patientId);expect(tables().get('PatientReferenceModel')).toHaveLength(1);expect((await call('discharges','POST',{...payload,patient:{displayName:'Changed'}})).status).toBe(409);});
 it('fails closed on email delivery failure',async()=>{const d=await approved();doubles.send.mockRejectedValue(new Error('service unavailable'));expect((await call(`discharges/${d.planId}/grant-access`,'POST',{version:3,email:'synthetic@example.com',enrollmentAuthorized:true})).status).toBe(503);expect(tables().get('InvitationModel')![0].state).toBe('FAILED');expect(tables().get('EpisodeModel')![0].state).toBe('APPROVED');expect(tables().get('AccountModel')).toHaveLength(0);});
 it('invalidates approval and access on clinical edits and rejects stale versions',async()=>{const d=await approved();expect((await call(`discharges/${d.planId}/review`,'PATCH',{version:1})).status).toBe(409);expect((await call(`discharges/${d.planId}/review`,'PATCH',{version:3})).status).toBe(200);expect(tables().get('EpisodeModel')![0].approval).toBeUndefined();expect(tables().get('ApprovalModel')![0].invalidatedAt).toBeInstanceOf(Date);expect((await call(`discharges/${d.planId}/grant-access`,'POST',{version:4,email:'synthetic@example.com',enrollmentAuthorized:true})).status).toBe(409);});
 it('ingests a synthetic TXT upload through multipart and records manual provenance',async()=>{const d=await draft();const form=new FormData();form.set('requestId','12345678-1234-4234-8234-123456789088');form.set('kind','CHART_CONTEXT');form.set('file',new File(['Synthetic historical chart context.'],'chart.txt',{type:'text/plain'}));const response=await providerBackend(new NextRequest(`http://localhost:3000/api/discharges/${d.planId}/sources`,{method:'POST',headers:{origin:'http://localhost:3000'},body:form}));expect(response.status).toBe(200);const result=await response.json();expect(result.originalStored).toBe(false);const source=tables().get('SourceModel')!.find(s=>s.sourceId===result.sourceId)!;expect(source.kind).toBe('CHART_CONTEXT');expect(source.text).toBe('Synthetic historical chart context.');expect(source.expiresAt).toEqual(tables().get('EpisodeModel')![0].expiresAt);});
 it('denies unknown provider records and fails real-service processing without fabricating a draft',async()=>{expect((await call('discharges/99999999-9999-4999-8999-999999999999')).status).toBe(404);const d=await draft();doubles.process.mockRejectedValue(new Error('AWS unavailable'));expect((await call(`discharges/${d.planId}/process`,'POST',{})).status).toBe(503);expect(tables().get('EpisodeModel')![0].state).toBe('DRAFT');expect(tables().get('ClinicalPlanModel')![0].content).toBeUndefined();});
});
