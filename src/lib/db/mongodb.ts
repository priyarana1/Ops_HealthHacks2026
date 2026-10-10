import mongoose from 'mongoose';
const state = globalThis as typeof globalThis & {
    mongoPromise?: Promise<typeof mongoose>;
};
export async function connectDB() {
    if (!process.env.MONGODB_URI)
        throw new Error('MONGODB_URI is required. No in-memory database is substituted.');
    state.mongoPromise ??= mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME || 'clearpath', serverSelectionTimeoutMS: 5000 });
    try {
        return await state.mongoPromise;
    }
    catch (e) {
        state.mongoPromise = undefined;
        throw e;
    }
}
