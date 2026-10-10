import { AppError } from '@/lib/security/core';
import { optionalDependency } from './dependencies';
export const MAX_DOCUMENT_BYTES=5*1024*1024;
export async function extractDocument(name:string,mime:string,buffer:Buffer) {
 if(!buffer.length || buffer.length>MAX_DOCUMENT_BYTES)throw new AppError(413,'Use a non-empty document no larger than 5 MB.');
 const ext=name.toLowerCase().split('.').pop();let text='',documentType='';
 if(ext==='txt' && ['text/plain','application/octet-stream',''].includes(mime)){
  if(buffer.includes(0))throw new AppError(415,'The text file contains binary content.');
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{throw new AppError(415,'TXT documents must use UTF-8 encoding.');}documentType='text/plain';
 }else if(ext==='pdf' && ['application/pdf','application/octet-stream',''].includes(mime)){
  if(buffer.subarray(0,5).toString()!=='%PDF-')throw new AppError(415,'File content is not a PDF.');
  const sdk=optionalDependency<{PDFParse:new(input:{data:Uint8Array;isEvalSupported:boolean;verbosity:number})=>{getInfo():Promise<{total:number}>;getText():Promise<{text:string}>;destroy():Promise<void>}}>('pdf-parse');
  const parser=new sdk.PDFParse({data:new Uint8Array(buffer),isEvalSupported:false,verbosity:0});
  try{const info=await parser.getInfo();if(info.total>100)throw new AppError(413,'PDF exceeds 100 pages; split it rather than silently truncating instructions.');text=(await parser.getText()).text;}catch(e){if(e instanceof AppError)throw e;throw new AppError(422,'PDF text extraction failed. Supply a readable, unencrypted document or paste text.');}finally{await parser.destroy().catch(()=>{});}documentType='application/pdf';
 }else if(ext==='docx' && ['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream',''].includes(mime)){
  if(buffer.length<4 || buffer.readUInt32LE(0)!==0x04034b50)throw new AppError(415,'File content is not a DOCX archive.');
  validateDocxArchive(buffer);
  const mammoth=optionalDependency<{extractRawText(input:{buffer:Buffer}):Promise<{value:string}>}>('mammoth');
  try{text=(await mammoth.extractRawText({buffer})).value;}catch{throw new AppError(422,'DOCX extraction failed. Supply a valid document or paste text.');}documentType='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
 }else throw new AppError(415,'Supported uploads are PDF, DOCX and UTF-8 TXT; extension, MIME type and content must agree.');
 text=text.trim();if(text.length<10)throw new AppError(422,'No readable discharge text was found. Scanned PDFs require OCR outside this prototype.');if(text.length>120000)throw new AppError(413,'Extracted text exceeds 120,000 characters.');return {text,documentType};
}
export function validateDocxArchive(buffer:Buffer){
 // Inspect central directory BEFORE decompression to bound ZIP expansion.
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw new AppError(415,'Invalid DOCX archive.');
 const entries=buffer.readUInt16LE(end+10);let offset=buffer.readUInt32LE(end+16),total=0,found=false;
 if(entries>1000 || entries===65535)throw new AppError(413,'DOCX archive has too many entries.');
 for(let i=0;i<entries;i++){
  if(offset+46>buffer.length || buffer.readUInt32LE(offset)!==0x02014b50)throw new AppError(415,'Invalid DOCX directory.');
  const flags=buffer.readUInt16LE(offset+8),size=buffer.readUInt32LE(offset+24),length=buffer.readUInt16LE(offset+28),extra=buffer.readUInt16LE(offset+30),comment=buffer.readUInt16LE(offset+32);
  const name=buffer.subarray(offset+46,offset+46+length).toString();total+=size;if(flags&1 || name.includes('..') || total>20*1024*1024)throw new AppError(413,'Encrypted or oversized DOCX archives are unsupported.');if(name==='word/document.xml')found=true;offset+=46+length+extra+comment;
 }
 if(!found)throw new AppError(415,'Archive does not contain a DOCX document.');
}
