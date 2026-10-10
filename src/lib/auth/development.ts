import { randomBytes } from 'node:crypto';
import { AppError } from '@/lib/security/core';
export interface ProviderSession {sessionHash:string; role:'provider'; identity:string; isAdmin:boolean; expiresAt:Date; planId?:string}
interface DevelopmentState {secret:string; sessions:Map<string,ProviderSession>; limits:Map<string,{count:number;expiresAt:number}>}
const globalState=globalThis as typeof globalThis & {clearpathDevelopment?:DevelopmentState};
export function developmentState() {
 if(process.env.NODE_ENV==='production') throw new AppError(503,'Development session storage is unavailable in production.');
 const state=globalState.clearpathDevelopment ??= {secret:randomBytes(48).toString('base64url'),sessions:new Map(),limits:new Map()};
 for(const [key,value] of state.sessions) if(value.expiresAt.getTime()<=Date.now()) state.sessions.delete(key);
 for(const [key,value] of state.limits) if(value.expiresAt<=Date.now()) state.limits.delete(key);
 return state;
}
export function sessionSecret() {
 if(process.env.AUTH_SECRET) {if(process.env.AUTH_SECRET.length<32) throw new AppError(503,'AUTH_SECRET must have at least 32 characters.');return process.env.AUTH_SECRET;}
 return developmentState().secret;
}
export function localWorkspaceEnabled() {return process.env.NODE_ENV!=='production' && !process.env.DEV_PROVIDER_EMAIL && !process.env.DEV_PROVIDER_PASSWORD && !process.env.DEV_PROVIDER_PASSWORD_HASH;}
