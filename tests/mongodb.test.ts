import { describe, it, expect, vi, beforeEach } from 'vitest';
const connect = vi.hoisted(() => vi.fn());
vi.mock('mongoose', () => ({ default: { connect } }));
import { connectDB } from '../src/lib/db/mongodb';
beforeEach(() => { delete (globalThis as typeof globalThis & {
    mongoPromise?: unknown;
}).mongoPromise; connect.mockReset(); });
describe('MongoDB connection contract (mocked driver)', () => { it('fails without credentials instead of silently substituting a demo DB', async () => { delete process.env.MONGODB_URI; await expect(connectDB()).rejects.toThrow('MONGODB_URI'); }); it('reuses concurrent connection requests', async () => { process.env.MONGODB_URI = 'mongodb://synthetic-test'; connect.mockResolvedValue({ connected: true }); await Promise.all([connectDB(), connectDB()]); expect(connect).toHaveBeenCalledTimes(1); }); it('allows retry after connection failure', async () => { process.env.MONGODB_URI = 'mongodb://synthetic-test'; connect.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({}); await expect(connectDB()).rejects.toThrow('offline'); await connectDB(); expect(connect).toHaveBeenCalledTimes(2); }); });
