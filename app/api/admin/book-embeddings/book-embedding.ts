import "server-only";
import { db } from "@/lib/db";
import { createEmbedding } from "./embedding";

type BookEmbeddingSourceRow = {
  id: string;
  title: string;
  authors: string[] | null;
  description: string | null;
  tags: string | null;
};

export async function rebuildBookEmbeddings(bookIds: string[]) {
  const uniqueBookIds = Array.from(new Set(bookIds)).filter(Boolean);
  if (uniqueBookIds.length === 0) return 0;

  const bookDB = (await db.query<BookEmbeddingSourceRow>(
    `SELECT
       b.id,
       b.title,
       b.authors,
       b.description,
       string_agg(t.tag, ',') AS tags
     FROM "Book" b
     LEFT JOIN "BookTag" bt ON bt."bookId" = b.id
     LEFT JOIN "TagList" t ON t.id = bt."tagId"
     WHERE b.id = ANY($1::text[])
     GROUP BY b.id`,
    [uniqueBookIds]
  )).rows;

  const embeddings = [];
  for (const book of bookDB) {
    const content = [
      book.title,
      book.authors ? book.authors.join(" ") : "",
      book.description,
      book.tags || "",
    ];
    const embedding = await createEmbedding(content, "passage");
    embeddings.push({
      bookId: book.id,
      content,
      embedding,
    });
  }

  if (embeddings.length === 0) return 0;

  const values = embeddings
    .map((_, index) => {
      const base = index * 3;
      return `($${base + 1}, $${base + 2}, $${base + 3}::vector, now())`;
    })
    .join(", ");

  const params = embeddings.flatMap((e) => [
    e.bookId,
    e.content.filter(Boolean).join("\n"),
    `[${e.embedding.join(",")}]`,
  ]);

  await db.query(
    `INSERT INTO "BookEmbedding" ("bookId", content, embedding, "updatedAt")
     VALUES ${values}
     ON CONFLICT ("bookId") DO UPDATE
     SET
       content = EXCLUDED.content,
       embedding = EXCLUDED.embedding,
       "updatedAt" = now()`,
    params
  );

  return embeddings.length;
}

export async function createMissingBookEmbeddings() {
  const bookDB = (await db.query<{ id: string }>(
    `SELECT b.id
     FROM "Book" b
     LEFT JOIN "BookEmbedding" be ON be."bookId" = b.id
     WHERE be."bookId" IS NULL`
  )).rows;

  return rebuildBookEmbeddings(bookDB.map((book) => book.id));
}
