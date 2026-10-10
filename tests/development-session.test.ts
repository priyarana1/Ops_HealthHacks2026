import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
const fixture=vi.hoisted(()=>({cookies:new Map<string,string>(),db:vi.fn(async()=>{throw new Error('No MongoDB in local workspace.');})}));
vi.mock('next/headers',()=>({cookies:async()=>({get:(name:string)=>fixture.cookies.has(name)?{name,value:fixture.cookies.get(name)}:undefined,set:(name:string,value:string)=>fixture.cookies.set(name,value)})}));
vi.mock('../src/lib/db/mongodb',()=>({connectDB:fixture.db}));
import { cookieSession,identity,issueSession,revokeSession } from '../src/lib/auth/session';
import { localWorkspaceEnabled,sessionSecret } from '../src/lib/auth/development';
beforeEach(()=>{vi.stubEnv('NODE_ENV','test');vi.stubEnv('MONGODB_URI','');vi.stubEnv('AUTH_SECRET','');vi.stubEnv('DEV_PROVIDER_EMAIL','');vi.stubEnv('DEV_PROVIDER_PASSWORD','');vi.stubEnv('DEV_PROVIDER_PASSWORD_HASH','');fixture.cookies.clear();fixture.db.mockClear();});
afterEach(()=>vi.unstubAllEnvs());
describe('Local server-side provider sessions without MongoDB/AWS',()=>{
 it('generates a server-only ephemeral signing secret without editing environment files',()=>{expect(sessionSecret().length).toBeGreaterThan(32);expect(sessionSecret()).toBe(sessionSecret());expect(process.env.AUTH_SECRET).toBe('');});
 it('issues a protected opaque cookie, enforces server-side role and supports revocation',async()=>{const key=await issueSession('provider','Local synthetic workspace',new Date(Date.now()+60000));expect((await identity('provider')).identity).toBe('Local synthetic workspace');const cookie=fixture.cookies.get('clearpath_session')!;expect(cookie).not.toContain('Local synthetic');expect(cookie).not.toContain(key);expect((await cookieSession()).token).toBeTruthy();await expect(identity('patient')).rejects.toThrow();await revokeSession(key);await expect(identity('provider')).rejects.toThrow();expect(fixture.db).not.toHaveBeenCalled();});
 it('denies expired local provider sessions',async()=>{await issueSession('provider','local',new Date(0));await expect(identity('provider')).rejects.toThrow();});
 it('disables no-credential development entry when credentials are configured or in production',()=>{expect(localWorkspaceEnabled()).toBe(true);vi.stubEnv('DEV_PROVIDER_EMAIL','provider@example.test');expect(localWorkspaceEnabled()).toBe(false);vi.stubEnv('DEV_PROVIDER_EMAIL','');vi.stubEnv('NODE_ENV','production');expect(localWorkspaceEnabled()).toBe(false);expect(()=>sessionSecret()).toThrow('production');});
});
