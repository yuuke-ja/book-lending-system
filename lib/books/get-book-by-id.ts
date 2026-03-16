import "server-only";
import { db } from "@/lib/db";

export type BookTag = {
  id: string;
  tag: string;
};

export type BookDetail = {
  id: string;
  title: string;
  authors: string[] | null;
  isbn13: string;
  description: string | null;
  thumbnail: string | null;
  averageRating: number;
  ratingCount: number;
  tags: BookTag[];
};

export async function getBookById(id: string): Promise<BookDetail | null> {
  const result = await db.query<BookDetail>(
    `SELECT
      b.id,
      b.title,
      b.authors,
      b.isbn13,
      b.description,
      b.thumbnail,
      COALESCE(AVG(br.rating), 0)::float AS "averageRating",
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object('id', tl.id, 'tag', tl.tag))
          FILTER (WHERE tl.id IS NOT NULL),
        '[]'::jsonb
      ) AS "tags"
    FROM "Book" b
    LEFT JOIN "BookReview" br ON br."bookId" = b.id
    LEFT JOIN "BookTag" bt ON bt."bookId" = b.id
    LEFT JOIN "TagList" tl ON tl.id = bt."tagId"
    WHERE b.id = $1
    GROUP BY
      b.id,
      b.title,
      b.authors,
      b.isbn13,
      b.description,
      b.thumbnail
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}
