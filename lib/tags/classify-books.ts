import { db } from "@/lib/db";

type ClassifyBooksOptions = {
  tagIds?: string[];
  bookIds?: string[];
};

export type BookTagMatch = {
  bookId: string;
  title: string;
  tagId: string;
  matchedTerm: string;
};

export async function findBookTagMatches(
  options: ClassifyBooksOptions = {}
): Promise<BookTagMatch[]> {
  if (options.tagIds?.length === 0 || options.bookIds?.length === 0) {
    return [];
  }
  const tagIds = options.tagIds?.length ? options.tagIds : null;
  const bookIds = options.bookIds?.length ? options.bookIds : null;

  const result = await db.query<BookTagMatch>(
    `WITH terms AS (
       SELECT id AS "tagId", trim(tag) AS term
       FROM "TagList"
       WHERE ($1::text[] IS NULL OR id = ANY($1::text[]))
         AND trim(tag) <> ''

       UNION ALL

       SELECT "tagId", trim(subterm) AS term
       FROM "TagSubterm"
       WHERE ($1::text[] IS NULL OR "tagId" = ANY($1::text[]))
         AND trim(subterm) <> ''
     ),
     matches AS (
       SELECT DISTINCT ON (b.id, terms."tagId")
         b.id AS "bookId",
         b.title,
         terms."tagId",
         terms.term AS "matchedTerm"
       FROM terms
       JOIN "Book" b
         ON b.title &@~ pgroonga_query_escape(terms.term)
         OR b.description &@~ pgroonga_query_escape(terms.term)
         OR b.authors &@~ pgroonga_query_escape(terms.term)
       WHERE ($2::text[] IS NULL OR b.id = ANY($2::text[]))
         AND NOT (terms.term ~* '^[a-z]$')
       ORDER BY
         b.id,
         terms."tagId",
         length(terms.term) DESC,
         terms.term ASC
     )
     SELECT
       "bookId",
       title,
       "tagId",
       "matchedTerm"
     FROM matches
     ORDER BY title ASC, "matchedTerm" ASC`,
    [tagIds, bookIds]
  );

  return result.rows;
}

export async function classifyBooks(options: ClassifyBooksOptions = {}) {
  if (options.tagIds?.length === 0 || options.bookIds?.length === 0) {
    return [];
  }

  const tagIds = options.tagIds?.length ? options.tagIds : null;
  const bookIds = options.bookIds?.length ? options.bookIds : null;
  const matches = await findBookTagMatches(options);

  await db.transaction(async (tx) => {
    await tx.query(
      `DELETE FROM "BookTag"
       WHERE source IN ('vector', 'keyword')
         AND ($1::text[] IS NULL OR "tagId" = ANY($1::text[]))
         AND ($2::text[] IS NULL OR "bookId" = ANY($2::text[]))`,
      [tagIds, bookIds]
    );

    if (matches.length > 0) {
      await tx.query(
        `INSERT INTO "BookTag" ("bookId", "tagId", source)
         SELECT "bookId", "tagId", 'keyword'
         FROM unnest($1::text[], $2::text[]) AS matched("bookId", "tagId")
         ON CONFLICT ("bookId", "tagId") DO NOTHING`,
        [
          matches.map((match) => match.bookId),
          matches.map((match) => match.tagId),
        ]
      );
    }
  });

  return matches;
}
