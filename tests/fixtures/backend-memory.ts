// Test-only repository double. This does NOT simulate transaction isolation or a live MongoDB server.
import { randomUUID } from 'node:crypto';
type Row=Record<string,unknown>;
const value=(row:Row,key:string)=>key.split('.').reduce<unknown>((v,k)=>v && typeof v==='object'?(v as Row)[k]:undefined,row);
function match(row:Row,filter:Row):boolean{return Object.entries(filter).every(([k,w])=>{
 if(k==='$or')return (w as Row[]).some(f=>match(row,f));
 const actual=value(row,k);if(w && typeof w==='object' && !(w instanceof Date))return Object.entries(w).every(([op,v])=>op==='$gt'?Number(actual)>Number(v):op==='$lt'?Number(actual)<Number(v):op==='$lte'?Number(actual)<=Number(v):op==='$gte'?Number(actual)>=Number(v):op==='$in'?(v as unknown[]).includes(actual):op==='$exists'?(actual!==undefined)===v:false);
 return actual===w;
});}
function update(row:Row,changes:Row){for(const [k,v] of Object.entries(changes.$set as Row || {}))row[k]=v;for(const k of Object.keys(changes.$unset as Row || {}))delete row[k];for(const [k,v] of Object.entries(changes.$inc as Row || {}))row[k]=Number(row[k] || 0)+Number(v);}
const doc=(row:Row)=>row?Object.assign(structuredClone(row),{toObject:()=>structuredClone(row)}):null;
function query(run:()=>unknown){return {then:(resolve:(v:unknown)=>unknown,reject?:(e:unknown)=>unknown)=>Promise.resolve().then(run).then(resolve,reject),session(){return this;},sort(){return this;},limit(){return this;},select(){return this;},lean(){return this;}};}
export function memoryDatabase(){const tables=new Map<string,Row[]>();return {tables,model(name:string){const rows:Row[]=[];tables.set(name,rows);return {
 findOne:(filter:Row)=>query(()=>doc(rows.find(r=>match(r,filter))!)),find:(filter:Row)=>query(()=>rows.filter(r=>match(r,filter)).map(r=>doc(r))),
 create:async(input:Row|Row[])=>{const items=(Array.isArray(input)?input:[input]).map(r=>({...structuredClone(r),_id:randomUUID()}));rows.push(...items);return Array.isArray(input)?items:items[0];},
 updateOne:async(filter:Row,changes:Row)=>{const r=rows.find(r=>match(r,filter));if(r)update(r,changes);return {modifiedCount:r?1:0};},
 updateMany:async(filter:Row,changes:Row)=>{const items=rows.filter(r=>match(r,filter));items.forEach(r=>update(r,changes));return {modifiedCount:items.length};},
 findOneAndUpdate:(filter:Row,changes:Row,options?:{upsert?:boolean})=>query(()=>{let row=rows.find(r=>match(r,filter));if(!row && options?.upsert){row={...filter,...changes.$setOnInsert as Row,_id:randomUUID()};rows.push(row);}if(!row)return null;update(row,changes);return doc(row);}),
 deleteMany:async(filter:Row)=>{let deletedCount=0;for(let i=rows.length-1;i>=0;i--)if(match(rows[i],filter)){rows.splice(i,1);deletedCount++;}return {deletedCount};},
 deleteOne:async(filter:Row)=>{const i=rows.findIndex(r=>match(r,filter));if(i>=0)rows.splice(i,1);return {deletedCount:i>=0?1:0};},
 };}};}
