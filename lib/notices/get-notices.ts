import { db } from "@/lib/db";
import type { Notice, NoticeRow } from "@/lib/notices/type";

export async function getNotices(): Promise<Notice[]> {
  const result = await db.query<NoticeRow>(
    `SELECT
      n.id,
      n.content,
      n.title,
      n."bookId",
      n."createdAt",
      b.title AS "linkedBookTitle",
      b.thumbnail AS "linkedBookThumbnail"
    FROM "Notice" n
    LEFT JOIN "Book" b ON b.id = n."bookId"
    ORDER BY n."createdAt" DESC`
  );

  return result.rows.map((notice) => ({
    id: notice.id,
    content: notice.content,
    title: notice.title,
    createdAt: notice.createdAt,
    linkedBook: notice.bookId
      ? {
          id: notice.bookId,
          title: notice.linkedBookTitle ?? "関連する本",
          thumbnail: notice.linkedBookThumbnail,
        }
      : null,
  }));
}
