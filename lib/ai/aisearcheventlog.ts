import "server-only";
import { db } from "@/lib/db";
import { recordSearchEvent } from "@/lib/search-event.server";

export type AisearchEventLog = {
  id: string;
  userEmail: string;
  query: string;
  recommendedBooks: string[];
  createdAt: Date;
};

type AisearchEventLogInput = {
  userEmail: string;
  query: string;
  recommendedBooks: string[];
};

export async function aisearcheventlog({
  userEmail,
  query,
  recommendedBooks,
}: AisearchEventLogInput) {
  const result = await db.query<{ id: string }>(
    `WITH terms AS (
         SELECT trim($1::text) AS term
         WHERE trim($1::text) <> ''
       ),
       matches_tags AS (
         SELECT tag.id
         FROM terms
         JOIN "TagList" tag
           ON terms.term &@~ pgroonga_query_escape(tag.tag)

         UNION ALL

         SELECT subterm."tagId" AS id
         FROM terms
         JOIN "TagSubterm" subterm
           ON terms.term &@~ pgroonga_query_escape(subterm.subterm)
       )
       SELECT DISTINCT id
       FROM matches_tags`,
    [query]
  );
  const matchedTagIds = result.rows.map((row) => row.id);

  let tagIds = matchedTagIds;
  let confidence = 1;

  if (matchedTagIds.length === 0 && recommendedBooks.length > 0) {
    const fallbackResult = await db.query<{ id: string }>(
      `SELECT "tagId" AS id
       FROM "BookTag"
       WHERE "bookId" = ANY($1::text[])
       GROUP BY "tagId"
       ORDER BY COUNT(*) DESC
       LIMIT 2`,
      [recommendedBooks]
    );

    tagIds = fallbackResult.rows.map((row) => row.id);
    confidence = 0.5;
  }

  return recordSearchEvent({
    userEmail,
    query,
    searchType: "ai_query",
    tagIds,
    confidence,
  });
}
