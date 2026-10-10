import Link from 'next/link';
import { identity } from '@/lib/auth/session';
import { connectDB } from '@/lib/db/mongodb';
import { EpisodeModel, PatientReferenceModel } from '@/lib/backend/models';
import Logout from '@/components/logout';
import EpicWorkspace from '@/components/epic-workspace';
export const dynamic='force-dynamic';
export default async function Provider(){
 const session=await identity('provider');
 let episodes:{episodeId:string;planId:string;state:string;dischargeAt:Date;expiresAt:Date}[]=[],names=new Map<string,string>();
 let persistenceMessage='MongoDB is not configured. Chart viewing is available; uploading and saving discharges require a database.';
 if(process.env.MONGODB_URI){try{
  await connectDB();
  episodes=await EpisodeModel.find({owner:session.identity,expiresAt:{$gt:new Date()}}).select('episodeId planId state dischargeAt expiresAt').sort({createdAt:-1}).limit(50).lean();
  names=new Map((await PatientReferenceModel.find({episodeId:{$in:episodes.map(e=>e.episodeId)}}).select('episodeId displayName').lean()).map(p=>[p.episodeId,p.displayName]));
  persistenceMessage='';
 }catch{persistenceMessage='MongoDB is unavailable. Epic connection and chart viewing remain available. Uploading and saving discharges require a working database.';}}
 return <main><div className="row"><h1>Provider workspace</h1><Logout/></div><p>ClearPath provider session: {session.identity}</p>
  <section className="card"><h2>New discharge</h2><p>Upload the finalized discharge document (PDF, Word or text). ClearPath saves its text and drafts plain-language instructions for your review.</p>{persistenceMessage?<p className="notice">{persistenceMessage}</p>:<Link className="button" href="/provider/upload">Upload discharge document</Link>}</section>
  <h2 style={{marginTop:32}}>Saved discharges</h2>{!persistenceMessage && !episodes.length && <p className="card">No saved discharges yet.</p>}
  {episodes.map(e=><article className="card" key={e.planId}><div className="row"><strong>{names.get(e.episodeId) || 'Unnamed patient'}</strong><span className="badge">{e.state.replace('_',' ')}</span></div><p className="muted">Discharged {new Date(e.dischargeAt).toLocaleString()} · access ends {new Date(e.expiresAt).toLocaleDateString()}</p><Link href={'/provider/discharge/'+e.planId}>Open discharge</Link></article>)}
  <h2 style={{marginTop:32}}>Epic chart</h2><p className="muted">Epic authorization is a separate clinician connection.</p><EpicWorkspace/>
 </main>;
}
