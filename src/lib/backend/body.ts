import { AppError } from '@/lib/security/core';
export async function boundedBody(request:Request,max:number){
 if(Number(request.headers.get('content-length'))>max)throw new AppError(413,'Request is too large.');
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new AppError(413,'Request is too large.');}chunks.push(value);}}finally{reader.releaseLock();}
 const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result;
}
export async function boundedJson(request:Request){const bytes=await boundedBody(request,300000);try{return JSON.parse(new TextDecoder().decode(bytes)) as unknown;}catch{throw new AppError(400,'Invalid JSON request.');}}
export async function boundedMultipart(request:Request,max:number){const bytes=await boundedBody(request,max);try{return await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type') || ''}}).formData();}catch{throw new AppError(400,'Invalid multipart upload.');}}
