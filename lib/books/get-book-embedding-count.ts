import "server-only";
import { db } from "@/lib/db";

export async function getBookEmbeddingCount() {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM "BookEmbedding"`
  );

  return Number(result.rows[0]?.count ?? 0);
}
