// /src/lib/db.js
import { Pool } from "pg";

// Reuse a single pool in dev/hot-reload to avoid exhausting connections
let _pool = globalThis.__PG_POOL__;
if (!_pool) {
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Neon uses SSL; with PGSSLMODE=require this is safe
    ssl: { rejectUnauthorized: false },
  });
  globalThis.__PG_POOL__ = _pool;
}

export const pool = _pool;

/** Simple helper for one-off queries */
export async function query(text, params) {
  return pool.query(text, params);
}

/** Use when you need a transaction or multiple statements on one client */
export async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export default pool;
