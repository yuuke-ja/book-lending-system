import "server-only";
import type { QueryResult, QueryResultRow } from "pg";
import { Pool } from "pg";

type DbClient = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
};

const globalForDb = globalThis as unknown as {
  pool?: Pool;
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const pool = globalForDb.pool ?? new Pool({ connectionString: databaseUrl });

async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  return pool.query<T>(text, params);
}

async function transaction<T>(callback: (tx: DbClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx: DbClient = {
      query: (text, params = []) => client.query(text, params),
    };
    const result = await callback(tx);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const db = {
  query,
  transaction,
};

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}
