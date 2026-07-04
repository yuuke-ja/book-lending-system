import "server-only";

import { db } from "@/lib/db";

export type RecommendBookFromHistory = {
  historyBookId: string;
  occurredAt: Date;
  bookId: string;
  distance: number;
};

type RecommendBookFromHistoryRow = Omit<
  RecommendBookFromHistory,
  "distance"
> & {
  distance: string | number;
};

export async function findCandidatesFromHistory(
  userEmail: string
): Promise<RecommendBookFromHistory[]> {
  // ユーザーの最近の行動履歴から本のembeddingを取り、その本に近い別の本を候補にする
  const result = await db.query<RecommendBookFromHistoryRow>(
    `WITH recent_book_events AS (
       SELECT
         event."bookId",
         event."occurredAt",
         source.embedding
       FROM "ResearchEvent" event
       JOIN "BookEmbedding" source
         ON source."bookId" = event."bookId"
       WHERE event."userEmail" = $1
         AND event."eventType" IN (
           'loan',
           'book_detail_view',
           'book_link_click'
         )
       ORDER BY event."occurredAt" DESC
       LIMIT 10
     )
     SELECT
       book_events."bookId" AS "historyBookId",
       book_events."occurredAt",
       candidate."bookId",
       candidate.distance
     FROM recent_book_events book_events
     CROSS JOIN LATERAL (
       SELECT
         embedding."bookId",
         embedding.embedding <=> book_events.embedding AS distance
       FROM "BookEmbedding" embedding
       WHERE embedding."bookId" <> book_events."bookId"
       ORDER BY embedding.embedding <=> book_events.embedding
       LIMIT 5
     ) candidate`,
    [userEmail]
  );

  return result.rows.map((row) => ({
    ...row,
    distance: Number(row.distance),
  }));
}
