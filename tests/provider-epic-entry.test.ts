import { afterEach,beforeEach,describe,it,expect,vi } from 'vitest';
import { NextRequest } from 'next/server';
const fixture=vi.hoisted(()=>({cookies:new Map<string,string>(),connect:vi.fn(async()=>{throw new Error('MongoDB deliberately unavailable');})}));
vi.mock('next/headers',()=>({cookies:async()=>({get:(name:string)=>fixture.cookies.has(name)?{name,value:fixture.cookies.get(name)}:undefined,set:(name:string,value:string)=>fixture.cookies.set(name,value)})}));
vi.mock('../src/lib/db/mongodb',()=>({connectDB:fixture.connect}));
import {GET,POST} from '../src/app/api/[...path]/route';
import {epicRoute} from '../src/lib/epic/http';
const get=(path:string)=>new NextRequest('http://localhost:3000/api/'+path);
const post=(path:string,origin='http://localhost:3000')=>new NextRequest('http://localhost:3000/api/'+path,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{}'});
beforeEach(()=>{vi.stubEnv('NODE_ENV','test');for(const key of ['MONGODB_URI','AWS_S3_BUCKET','AUTH_SECRET','DEV_PROVIDER_EMAIL','DEV_PROVIDER_PASSWORD','DEV_PROVIDER_PASSWORD_HASH'])vi.stubEnv(key,'');vi.stubEnv('APP_URL','http://localhost:3000');vi.stubEnv('EPIC_CLIENT_ID','test-client');vi.stubEnv('EPIC_CLIENT_SECRET','unit-test-secret');vi.stubEnv('EPIC_REDIRECT_URI','http://localhost:3000/api/epic/callback');vi.stubEnv('EPIC_SCOPES','');vi.stubEnv('EPIC_TOKEN_AUTH_METHOD','client_secret_basic');fixture.cookies.clear();fixture.connect.mockClear();});
afterEach(()=>vi.unstubAllEnvs());
describe('Real local session and API routing with database unavailable',()=>{
 it('enters the localhost provider workspace and accesses Epic status without MongoDB/AWS',async()=>{expect((await (await GET(get('auth/config'))).json()).localWorkspaceEnabled).toBe(true);expect((await POST(post('auth/development'))).status).toBe(200);expect((await GET(get('auth/me'))).status).toBe(200);const response=await epicRoute(get('epic/status'));expect(response.status).toBe(200);const status=await response.json();expect(status.connected).toBe(false);expect(status.configured).toBe(true);expect(status.storage).toBe('server-memory');expect(status.persistenceEnabled).toBe(false);expect(fixture.connect).not.toHaveBeenCalled();});
 it('does not allow unauthenticated or tampered-cookie Epic access',async()=>{expect((await epicRoute(get('epic/status'))).status).toBe(401);fixture.cookies.set('clearpath_session','tampered');expect((await epicRoute(get('epic/patients?name=Synthetic'))).status).toBe(401);expect(fixture.connect).not.toHaveBeenCalled();});
 it('rejects cross-origin local-session creation and disables the entry in production',async()=>{expect((await POST(post('auth/development','https://attacker.example'))).status).toBe(403);vi.stubEnv('NODE_ENV','production');expect((await POST(post('auth/development'))).status).toBe(403);});
 it('signs out and revokes the local provider session without requiring the database',async()=>{await POST(post('auth/development'));expect((await POST(post('auth/logout'))).status).toBe(200);expect((await GET(get('auth/me'))).status).toBe(401);expect(fixture.connect).not.toHaveBeenCalled();});
});
