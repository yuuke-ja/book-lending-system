import "server-only";
import { db } from "@/lib/db";
export type RecommendBookFromTagCandidate = {
  historyBookId: string;
  occurredAt: Date;
  bookId: string;
};

export async function findTagCandidatesFromHistory(
  userEmail: string
): Promise<RecommendBookFromTagCandidate[]> {
  const result = await db.query<RecommendBookFromTagCandidate>(
    `WITH recent_book_events AS (
       SELECT
         event."bookId" AS "historyBookId",
         event."occurredAt"
       FROM "ResearchEvent" event
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
       book_events."historyBookId",
       book_events."occurredAt",
       candidate_book.id AS "bookId"
     FROM recent_book_events book_events
     JOIN "Book" candidate_book
       ON candidate_book.id <> book_events."historyBookId"
     WHERE EXISTS (
       SELECT 1
       FROM "BookTag" source_tag
       JOIN "BookTag" candidate_tag
         ON candidate_tag."tagId" = source_tag."tagId"
       WHERE source_tag."bookId" = book_events."historyBookId"
         AND candidate_tag."bookId" = candidate_book.id
     )`,
    [userEmail]
  );

  return result.rows;
}
