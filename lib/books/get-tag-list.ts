import "server-only";
import { db } from "@/lib/db";
import type { BookListTag } from "@/lib/books/book-list-types";

export async function getTagList(): Promise<BookListTag[]> {
  const result = await db.query<BookListTag>(
    `SELECT id, tag FROM "TagList" ORDER BY tag ASC`
  );

  return result.rows;
}
