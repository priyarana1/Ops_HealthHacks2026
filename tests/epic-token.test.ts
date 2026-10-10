import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { tokenRequest } from '../src/lib/epic/client-auth';
import { epicJson } from '../src/lib/epic/config';
import { lastTokenFailure,reportTokenFailure,tokenFailureDiagnostic } from '../src/lib/epic/token-diagnostics';
const endpoint='https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token';
beforeEach(()=>{
 vi.stubEnv('EPIC_CLIENT_ID','client:id /+');vi.stubEnv('EPIC_CLIENT_SECRET','secret:/+ %&=');vi.stubEnv('EPIC_TOKEN_AUTH_METHOD','client_secret_basic');vi.stubEnv('EPIC_REDIRECT_URI','http://localhost:3000/api/epic/callback');vi.stubEnv('APP_URL','http://localhost:3000');vi.stubEnv('EPIC_SCOPES','openid');vi.stubEnv('EPIC_FHIR_BASE_URL','https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/');
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('Epic confidential token POST regression',()=>{
 it('matches independent literal Basic encoding and form serialization at the fetch boundary',async()=>{
  const fetchMock=vi.fn(async()=>new Response('{}',{status:400}));vi.stubGlobal('fetch',fetchMock);
  const request=await tokenRequest('code/+&=','http://localhost:3000/api/epic/callback',endpoint,'v'.repeat(43));
  await epicJson(endpoint,{method:'POST',...request});
  const [url,init]=fetchMock.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe(endpoint);expect(init.method).toBe('POST');expect(init.redirect).toBe('error');
  const headers=new Headers(init.headers);expect(headers.get('content-type')).toBe('application/x-www-form-urlencoded');expect(headers.get('authorization')).toBe('Basic '+Buffer.from('client%3Aid+%2F%2B:secret%3A%2F%2B+%25%26%3D').toString('base64'));
  const wire=new Request(url,init);expect(await wire.text()).toBe('grant_type=authorization_code&code=code%2F%2B%26%3D&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fepic%2Fcallback&code_verifier='+'v'.repeat(43));
  expect(request.body.has('client_id')).toBe(false);expect(request.body.has('client_secret')).toBe(false);expect(request.body.has('client_assertion')).toBe(false);
 });
 it('matches the exact Basic header published in Epic documentation',async()=>{
  vi.stubEnv('EPIC_CLIENT_ID','d45049c3-3441-40ef-ab4d-b9cd86a17225');vi.stubEnv('EPIC_CLIENT_SECRET','this-is-the-secret-2/7');
  const request=await tokenRequest('synthetic-code','http://localhost:3000/api/epic/callback',endpoint,'v'.repeat(43));
  expect(request.headers.Authorization).toBe('Basic ZDQ1MDQ5YzMtMzQ0MS00MGVmLWFiNGQtYjljZDg2YTE3MjI1OnRoaXMtaXMtdGhlLXNlY3JldC0yJTJGNw==');
  expect(request.body.has('client_id')).toBe(false);
 });
 it('retains only sanitized session-scoped development evidence',()=>{
  vi.stubEnv('NODE_ENV','development');vi.spyOn(console,'warn').mockImplementation(()=>{});
  reportTokenFailure(401,{error:'invalid_client',error_description:null,code:'SECRET'},'client_secret_basic',true,'synthetic-provider-session');
  expect(lastTokenFailure('another-session')).toBeNull();
  expect(lastTokenFailure('synthetic-provider-session')).toMatchObject({httpStatus:401,oauthError:'invalid_client',oauthErrorDescription:null});
  expect(JSON.stringify(lastTokenFailure('synthetic-provider-session'))).not.toContain('SECRET');
  vi.spyOn(Date,'now').mockReturnValue(Date.now()+16*60*1000);
  expect(lastTokenFailure('synthetic-provider-session')).toBeNull();
 });
 it('captures actual status, standard error and a null Epic description without serializing response extras',()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  reportTokenFailure(401,{error:'invalid_client',error_description:null,access_token:'NEVER-LOG',code:'NEVER-LOG'},'client_secret_basic',true);
  const record=JSON.parse(warn.mock.calls[0][1] as string);expect(record.httpStatus).toBe(401);expect(record.oauthError).toBe('invalid_client');expect(record.oauthErrorDescription).toBeNull();expect(JSON.stringify(warn.mock.calls)).not.toContain('NEVER-LOG');
 });
 it('preserves fixed safe descriptions but suppresses arbitrary text and unknown errors',()=>{
  expect(tokenFailureDiagnostic(400,{error:'invalid_client',error_description:'Invalid client credentials.'},'client_secret_basic',true).oauthErrorDescription).toBe('Invalid client credentials.');
  const diagnostic=tokenFailureDiagnostic(400,{error:'secret error text',error_description:'Basic SECRET code=CODE verifier=VERIFIER https://localhost/callback?state=STATE'},'client_secret_basic',true);
  expect(diagnostic.oauthError).toBe('unrecognized_or_missing');expect(diagnostic.oauthErrorDescription).toContain('suppressed');for(const secret of ['SECRET','CODE','VERIFIER','STATE'])expect(JSON.stringify(diagnostic)).not.toContain(secret);
 });
 it('handles non-JSON, null and array error responses without leaking or crashing',()=>{
  for(const result of [null,[],{error_description:{secret:'NEVER-LOG'}},'<html>NEVER-LOG</html>'])expect(JSON.stringify(tokenFailureDiagnostic(502,result,'client_secret_basic',true))).not.toContain('NEVER-LOG');
 });
});
