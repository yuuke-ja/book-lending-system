import "server-only";

import { createEmbedding } from "@/app/api/admin/book-embeddings/embedding";
import { db } from "@/lib/db";

export type EmbeddingTestMode = "query" | "book";

export type EmbeddingTestBook = {
  id: string;
  title: string;
};

export type EmbeddingTestResult = {
  id: string;
  title: string;
  authors: string[] | null;
  description: string | null;
  thumbnail: string | null;
  tags: string[];
  embeddingContent: string;
  distance: number;
  similarity: number;
};

type EmbeddingTestRow = Omit<
  EmbeddingTestResult,
  "distance" | "similarity"
> & {
  distance: string | number;
  similarity: string | number;
};

export async function getEmbeddingTestBooks(): Promise<EmbeddingTestBook[]> {
  const result = await db.query<EmbeddingTestBook>(
    `SELECT b.id, b.title
     FROM "Book" b
     INNER JOIN "BookEmbedding" be ON be."bookId" = b.id
     ORDER BY b.title ASC`
  );

  return result.rows;
}

export async function testBookEmbeddings({
  mode,
  query,
  bookId,
  limit,
}: {
  mode: EmbeddingTestMode;
  query?: string;
  bookId?: string;
  limit: number;
}): Promise<EmbeddingTestResult[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  let vectorExpression: string;
  let params: unknown[];
  let excludedBookId: string | null = null;

  if (mode === "query") {
    const normalizedQuery = query?.trim() ?? "";
    if (!normalizedQuery) {
      throw new Error("検索語を入力してください");
    }

    const embedding = await createEmbedding(normalizedQuery, "query");
    vectorExpression = "$1::vector";
    params = [`[${embedding.join(",")}]`, safeLimit];
  } else {
    const normalizedBookId = bookId?.trim() ?? "";
    if (!normalizedBookId) {
      throw new Error("基準にする本を選択してください");
    }

    const source = await db.query<{ embedding: string }>(
      `SELECT embedding::text AS embedding
       FROM "BookEmbedding"
       WHERE "bookId" = $1
       LIMIT 1`,
      [normalizedBookId]
    );

    if (!source.rows[0]) {
      throw new Error("選択した本のEmbeddingがありません");
    }

    vectorExpression = "$1::vector";
    params = [source.rows[0].embedding, normalizedBookId, safeLimit];
    excludedBookId = normalizedBookId;
  }

  const limitParameter = mode === "query" ? "$2" : "$3";
  const exclusionCondition =
    excludedBookId === null ? "" : `AND b.id <> $2`;

  const result = await db.query<EmbeddingTestRow>(
    `SELECT
       b.id,
       b.title,
       b.authors,
       b.description,
       b.thumbnail,
       COALESCE(
         array_agg(DISTINCT tl.tag ORDER BY tl.tag)
           FILTER (WHERE tl.tag IS NOT NULL),
         ARRAY[]::text[]
       ) AS tags,
       be.content AS "embeddingContent",
       ROUND((be.embedding <=> ${vectorExpression})::numeric, 6) AS distance,
       ROUND((1 - (be.embedding <=> ${vectorExpression}))::numeric, 6) AS similarity
     FROM "BookEmbedding" be
     INNER JOIN "Book" b ON b.id = be."bookId"
     LEFT JOIN "BookTag" bt ON bt."bookId" = b.id
     LEFT JOIN "TagList" tl ON tl.id = bt."tagId"
     WHERE true
       ${exclusionCondition}
     GROUP BY
       b.id,
       b.title,
       b.authors,
       b.description,
       b.thumbnail,
       be.content,
       be.embedding
     ORDER BY be.embedding <=> ${vectorExpression}
     LIMIT ${limitParameter}`,
    params
  );

  return result.rows.map((row) => ({
    ...row,
    distance: Number(row.distance),
    similarity: Number(row.similarity),
  }));
}
