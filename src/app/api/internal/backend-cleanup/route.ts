import { NextRequest } from 'next/server';
import { handler } from '@/lib/security/http';
import { equal,AppError } from '@/lib/security/core';
import { purgeBackend } from '@/lib/backend/cleanup';
export const runtime='nodejs';
export const POST=handler(async(req:NextRequest)=>{const value=req.headers.get('authorization')?.replace(/^Bearer /,'') || '';if(!process.env.PURGE_SECRET || !equal(value,process.env.PURGE_SECRET))throw new AppError(401,'Unauthorized cleanup invocation.');return purgeBackend();},{internal:true});
