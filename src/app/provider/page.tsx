import Link from 'next/link';
import { identity } from '@/lib/auth/session';
import { connectDB } from '@/lib/db/mongodb';
import { DischargePlan } from '@/lib/db/models';
import Logout from '@/components/logout';
import EpicWorkspace from '@/components/epic-workspace';
export const dynamic='force-dynamic';
export default async function Provider(){
 const session=await identity('provider');
 let plans:{planId:string;status:string;expiresAt:Date}[]=[];
 let persistenceMessage='MongoDB is not configured. Chart viewing and temporary discharge preparation are available without persistence.';
 if(process.env.MONGODB_URI){try{await connectDB();plans=await DischargePlan.find({owner:session.identity,expiresAt:{$gt:new Date()}}).sort({createdAt:-1}).limit(50);persistenceMessage='';}catch{persistenceMessage='MongoDB is unavailable. Epic connection and chart viewing remain available. Saving plans requires a working database.';}}
 return <main><div className="row"><h1>Provider workspace</h1><Logout/></div><p>ClearPath provider session: {session.identity}</p><p className="muted">Prepare, review, and publish synthetic discharge plans. Epic authorization is a separate clinician connection.</p><EpicWorkspace/><Link className="button" href="/provider/new">Start a new discharge / paste AVS</Link>{persistenceMessage && <p className="notice">{persistenceMessage}</p>}<h2 style={{marginTop:32}}>Saved discharge plans</h2>{!plans.length && <p className="card">No saved plans are available.</p>}{plans.map(plan=><article className="card" key={plan.planId}><span className="badge">{plan.status}</span><p>Plan {plan.planId}</p><p className="muted">Expires {new Date(plan.expiresAt).toLocaleDateString()}</p><Link href={'/provider/review/'+plan.planId}>Open review</Link></article>)}</main>;
}
