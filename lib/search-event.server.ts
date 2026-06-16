import "server-only";

import { db } from "@/lib/db";

type SearchType = "book_list" | "ai_query";

type SearchEventRow = {
  id: string;
  userEmail: string;
  searchType: SearchType;
  query: string;
  occurredAt: Date;
};

type RecordSearchEventInput = {
  userEmail: string;
  query: string;
  searchType: SearchType;
  tagIds?: string[];
  confidence?: number;
};

export async function recordSearchEvent({
  userEmail,
  query,
  searchType,
  tagIds = [],
  confidence = 1,
}: RecordSearchEventInput) {
  const uniqueTagIds = Array.from(new Set(tagIds.filter(Boolean)));

  return db.transaction(async (tx) => {
    const eventResult = await tx.query<SearchEventRow>(
      `INSERT INTO "SearchEvent" ("userEmail", "searchType", query)
       VALUES ($1, $2, $3)
       RETURNING id, "userEmail", "searchType", query, "occurredAt"`,
      [userEmail, searchType, query]
    );
    const searchEvent = eventResult.rows[0];

    if (uniqueTagIds.length > 0) {
      await tx.query(
        `INSERT INTO "SearchEventTag" ("searchEventId", "tagId", confidence)
         SELECT $1, tag_id, $3
         FROM unnest($2::text[]) AS input(tag_id)
         ON CONFLICT ("searchEventId", "tagId") DO NOTHING`,
        [searchEvent.id, uniqueTagIds, confidence]
      );
    }

    return searchEvent;
  });
}
