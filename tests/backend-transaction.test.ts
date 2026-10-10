import {afterEach,describe,expect,it,vi} from 'vitest';
import mongoose from 'mongoose';
vi.mock('../src/lib/db/mongodb',()=>({connectDB:vi.fn(async()=>{})}));
import {transaction} from '../src/lib/backend/repository';
afterEach(()=>vi.restoreAllMocks());
function session(run:(fn:()=>Promise<unknown>)=>Promise<unknown>){
 const endSession=vi.fn(async()=>{});
 vi.spyOn(mongoose,'startSession').mockResolvedValue({withTransaction:run,endSession} as unknown as mongoose.ClientSession);
 return endSession;
}
describe('Transaction completion (driver double, no live database)',()=>{
 it('accepts committed callbacks returning void',async()=>{
  const end=session(async fn=>fn());
  await expect(transaction(async()=>{})).resolves.toBeUndefined();
  expect(end).toHaveBeenCalledOnce();
 });
 it('preserves callback return values',async()=>{
  session(async fn=>fn());
  await expect(transaction(async()=>({state:'APPROVED'}))).resolves.toEqual({state:'APPROVED'});
 });
 it('propagates database failures and closes the session',async()=>{
  const end=session(async()=>{throw new Error('synthetic transaction error');});
  await expect(transaction(async()=>{})).rejects.toThrow('synthetic transaction error');
  expect(end).toHaveBeenCalledOnce();
 });
 it('still rejects an aborted transaction without a completion result',async()=>{
  session(async()=>undefined);
  await expect(transaction(async()=>{})).rejects.toThrow('Database transaction did not complete');
 });
});
