import "server-only";

import { db } from "@/lib/db";

export type RecommendBookFromSearchTagCandidate = {
  sourceQuery: string;
  occurredAt: Date;
  tagId: string;
  matchedTerm: string;
  bookId: string;
};

export async function findTagCandidatesFromSearchHistory(
  userEmail: string
): Promise<RecommendBookFromSearchTagCandidate[]> {
  const result = await db.query<RecommendBookFromSearchTagCandidate>(
    `
    WITH recent_search_events AS (
      SELECT
        event.id AS "searchEventId",
        event.query AS "sourceQuery",
        event."occurredAt"
      FROM "SearchEvent" event
      WHERE event."userEmail" = $1
        AND event."searchType" IN (
          'ai_query',
          'book_list'
        )
        AND trim(event.query) <> ''
      ORDER BY event."occurredAt" DESC
      LIMIT 5
    ),
    matches_tags AS (
      SELECT
        search_events."searchEventId",
        search_events."sourceQuery",
        search_events."occurredAt",
        tag.id AS "tagId",
        tag.tag AS "matchedTerm"
      FROM recent_search_events search_events
      JOIN "TagList" tag
        ON search_events."sourceQuery" &@~ pgroonga_query_escape(tag.tag)

      UNION ALL

      SELECT
        search_events."searchEventId",
        search_events."sourceQuery",
        search_events."occurredAt",
        subterm."tagId",
        subterm.subterm AS "matchedTerm"
      FROM recent_search_events search_events
      JOIN "TagSubterm" subterm
        ON search_events."sourceQuery" &@~ pgroonga_query_escape(subterm.subterm)
    )
    SELECT DISTINCT
      matches_tags."sourceQuery",
      matches_tags."occurredAt",
      matches_tags."tagId",
      matches_tags."matchedTerm",
      book_tag."bookId"
    FROM matches_tags
    JOIN "BookTag" book_tag
      ON book_tag."tagId" = matches_tags."tagId"
    `,
    [userEmail]
  );
  return result.rows;
}
