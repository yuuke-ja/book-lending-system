import "server-only";


import { db } from "@/lib/db";


import { createEmbedding } from "@/app/api/admin/book-embeddings/embedding";

type SearchHistory = {
  query: string;
  occurredAt: Date;
};

export type RecommendBookFromSearchHistory = {
  sourceQuery: string;
  occurredAt: Date;
  bookId: string;
  distance: number;
};

type RecommendBookFromSearchHistoryRow = Omit<
  RecommendBookFromSearchHistory,
  "distance"
> & {
  distance: string | number;
};

export async function findCandidatesFromSearchHistory(
  userEmail: string
): Promise<RecommendBookFromSearchHistory[]> {
  // 検索語はベクトルを持っていないので、その場でベクトル化する
  const historysearchResult = await db.query<SearchHistory>(
    `SELECT query, "occurredAt"
     FROM "SearchEvent"
     WHERE "userEmail" = $1
     ORDER BY "occurredAt" DESC
     LIMIT 5`,
    [userEmail]
  )
  if (historysearchResult.rows.length === 0) {
    return [];
  }

  const historysearchVectors = await Promise.all(
    historysearchResult.rows.map(async (history) => {
      const embedding = await createEmbedding(history.query, "query")
      return {
        ...history,
        embedding: `[${embedding.join(",")}]`,
      }
    }
    )
  )

  // embedding化した検索語ごとに、意味が近い本をBookEmbeddingから探す
  const resultcandidate = await db.query<RecommendBookFromSearchHistoryRow>(
    `
    WITH recent_history AS (
      SELECT
        input.query,
        input."occurredAt",
        input.embedding
      FROM unnest( 
        $1::text[],
        $2::timestamp[],
        $3::text[] )
      AS input(
        query,"occurredAt",embedding
      )
    )
    SELECT 
      history.query AS "sourceQuery",
      history."occurredAt",
      candidate."bookId",
      candidate.distance
    FROM recent_history history
    CROSS JOIN LATERAL (
      SELECT
        embedding."bookId",
        embedding.embedding <=> history.embedding::vector AS distance
      FROM "BookEmbedding" embedding
      ORDER BY embedding.embedding <=> history.embedding::vector
      LIMIT 5
    ) candidate
    `,

    [
      historysearchVectors.map((searchHistory) => searchHistory.query),
      historysearchVectors.map((searchHistory) => searchHistory.occurredAt),
      historysearchVectors.map((searchHistory) => searchHistory.embedding),
    ]
  )

  return resultcandidate.rows.map((row) => ({
    ...row,
    distance: Number(row.distance),
  }))
}
