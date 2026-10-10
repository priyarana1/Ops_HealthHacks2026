import nextEnv from '@next/env';
import mongoose from 'mongoose';
nextEnv.loadEnvConfig(process.cwd(),true);
if(!process.env.MONGODB_URI){console.error('MONGODB_URI is missing. Add it to .env.local.');process.exitCode=1;}
else {
 try {
  await mongoose.connect(process.env.MONGODB_URI,{dbName:process.env.MONGODB_DB_NAME || 'clearpath',serverSelectionTimeoutMS:5000});
  await mongoose.connection.db.admin().ping();
  console.log('MongoDB ping succeeded. This read-only check did not create or alter records.');
 } catch(error) {
  console.error('MongoDB ping failed. Check Atlas database-user credentials, IP access list, URI, and network access.');
  console.error('Error category:',error.name,'Code:',typeof error.code==='string' || typeof error.code==='number'?error.code:'unavailable');
  process.exitCode=1;
 } finally {await mongoose.disconnect();}
}
