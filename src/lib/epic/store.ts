import { EpicConnection, OAuthAttempt } from '@/lib/db/models';
import { connectDB } from '@/lib/db/mongodb';
export interface OAuthAttemptRecord {stateHash:string;sessionId:string;verifier?:string;nonce?:string;tokenEndpoint:string;authMethods?:string[];redirectUri:string;clientId:string;scope:string;expiresAt:Date}
export interface Clinician {subject:string;fhirUser?:string;displayName?:string;verified:true;profileMessage?:string}
export interface ConnectionRecord {sessionId:string;issuer:string;encryptedToken:string;scope:string;expiresAt:Date;clinician?:Clinician;identityMessage?:string}
const globalState=globalThis as typeof globalThis & {clearpathEpic?:{attempts:Map<string,OAuthAttemptRecord>;connections:Map<string,ConnectionRecord>}};
function memory(){const state=globalState.clearpathEpic ??= {attempts:new Map(),connections:new Map()};for(const [k,v] of state.attempts) if(v.expiresAt.getTime()<=Date.now())state.attempts.delete(k);for(const [k,v] of state.connections)if(v.expiresAt.getTime()<=Date.now())state.connections.delete(k);return state;}
const development=()=>process.env.NODE_ENV!=='production';
export const epicStore={
 async putAttempt(value:OAuthAttemptRecord){if(development())memory().attempts.set(value.stateHash,value);else{await connectDB();await OAuthAttempt.create(value);}},
 async takeAttempt(stateHash:string,sessionId:string):Promise<OAuthAttemptRecord|null>{if(development()){const state=memory(),value=state.attempts.get(stateHash);if(!value || value.sessionId!==sessionId)return null;state.attempts.delete(stateHash);return value;}await connectDB();return OAuthAttempt.findOneAndDelete({stateHash,sessionId,expiresAt:{$gt:new Date()}}).lean() as unknown as Promise<OAuthAttemptRecord|null>;},
 async putConnection(value:ConnectionRecord){if(development())memory().connections.set(value.sessionId,value);else{await connectDB();await EpicConnection.findOneAndUpdate({sessionId:value.sessionId},value,{upsert:true});}},
 async getConnection(sessionId:string):Promise<ConnectionRecord|null>{if(development())return memory().connections.get(sessionId) || null;await connectDB();return EpicConnection.findOne({sessionId,expiresAt:{$gt:new Date()}}).lean() as unknown as Promise<ConnectionRecord|null>;},
 async disconnect(sessionId:string){if(development()){const state=memory();state.connections.delete(sessionId);for(const [key,value] of state.attempts)if(value.sessionId===sessionId)state.attempts.delete(key);}else{await connectDB();await EpicConnection.deleteOne({sessionId});await OAuthAttempt.deleteMany({sessionId});}}
};
