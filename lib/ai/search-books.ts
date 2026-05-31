import "server-only";
import { db } from "@/lib/db";
import { createEmbedding } from "@/app/api/admin/book-embeddings/embedding";
export type SearchBookResult = {
  id: string;
  title: string;
  authors: string[] | null;
  description: string | null;
  thumbnail: string | null;
  distance: number;
  community: string[];
};

export async function searchBooks(query: string): Promise<SearchBookResult[]> {
  if (!query.trim()) return [];
  const embedding = await createEmbedding(query, "query");
  const vector = `[${embedding.join(",")}]`;

  const result = await db.query<SearchBookResult>(
    `WITH candidate_books AS (
      SELECT
        b.id,
        b.title,
        b.authors,
        b.description,
        b.thumbnail,
        be.embedding <=> $1::vector AS distance
      FROM "BookEmbedding" be
      JOIN "Book" b ON b.id = be."bookId"
      ORDER BY be.embedding <=> $1::vector
      LIMIT 5
    ),
    community_items AS (
      SELECT
        t."bookId",
        COALESCE(NULLIF(t."aiSummary", ''), t.content) AS content,
        t."createdAt"
      FROM "Thread" t
      JOIN candidate_books cb ON cb.id = t."bookId"

      UNION ALL

      SELECT
        t."bookId",
        COALESCE(NULLIF(tc."aiSummary", ''), tc.content) AS content,
        tc."createdAt"
      FROM "ThreadComment" tc
      JOIN "Thread" t ON t.id = tc."threadId"
      JOIN candidate_books cb ON cb.id = t."bookId"
    )
    SELECT
      cb.id,
      cb.title,
      cb.authors,
      cb.description,
      cb.thumbnail,
      cb.distance,
      COALESCE(
        jsonb_agg(
          ci.content
          ORDER BY ci."createdAt" DESC
        ) FILTER (WHERE ci.content IS NOT NULL),
        '[]'::jsonb
      ) AS community
    FROM candidate_books cb
    LEFT JOIN community_items ci ON ci."bookId" = cb.id
    GROUP BY
      cb.id,
      cb.title,
      cb.authors,
      cb.description,
      cb.thumbnail,
      cb.distance
    ORDER BY cb.distance;`,
    [vector]
  );

  return result.rows;
}






























