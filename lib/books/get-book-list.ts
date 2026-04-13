import "server-only";
import { db } from "@/lib/db";
import type { BookListBook } from "@/lib/books/book-list-types";

export async function getBookList(): Promise<BookListBook[]> {
  const books = await db.query<BookListBook>(
    `WITH review_summary AS (
       SELECT
         "bookId",
         AVG(rating)::float AS "averageRating"
       FROM "BookReview"
       GROUP BY "bookId"
     ),
     tag_summary AS (
       SELECT
         bt."bookId",
         jsonb_agg(
           jsonb_build_object('id', tl.id, 'tag', tl.tag)
           ORDER BY tl.tag
         ) AS "tags"
       FROM "BookTag" bt
       INNER JOIN "TagList" tl ON tl.id = bt."tagId"
       GROUP BY bt."bookId"
     )
     SELECT
       b.id,
       b.isbn13,
       b.title,
       b.authors,
       b.thumbnail,
       COALESCE(rs."averageRating", 0)::float AS "averageRating",
       COALESCE(ts."tags", '[]'::jsonb) AS "tags"
     FROM "Book" b
     LEFT JOIN review_summary rs ON rs."bookId" = b.id
     LEFT JOIN tag_summary ts ON ts."bookId" = b.id
     ORDER BY b."createdAt" DESC`
  );

  return books.rows;
}
