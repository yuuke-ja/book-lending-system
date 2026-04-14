import { db } from "@/lib/db";

type CommunityThreadRow = {
  id: string;
  content: string;
  bookId: string | null;
  kind: string;
  createdAt: string;
  bookTitle?: string | null;
  bookThumbnail?: string | null;
  nickname?: string | null;
  authorAvatarUrl?: string | null;
};

export async function getThreadList(bookId?: string | null) {
  const result = bookId
    ? await db.query<CommunityThreadRow>(
      `SELECT
           t.id,
           t.content,
           t."bookId",
           t.kind,
           t."createdAt",
           b.title AS "bookTitle",
           b.thumbnail AS "bookThumbnail",
           u.nickname AS nickname,
           u.avatarurl AS "authorAvatarUrl"
         FROM "Thread" t
         LEFT JOIN "Book" AS b ON b.id = t."bookId"
         LEFT JOIN "User" AS u ON u.email = t."userEmail"
         WHERE t."bookId" = $1
         ORDER BY t."createdAt" DESC`,
      [bookId]
    )
    : await db.query<CommunityThreadRow>(
      `SELECT
           t.id,
           t.content,
           t."bookId",
           t.kind,
           t."createdAt",
           b.title AS "bookTitle",
           b.thumbnail AS "bookThumbnail",
           u.nickname AS nickname,
           u.avatarurl AS "authorAvatarUrl"
         FROM "Thread" t
         LEFT JOIN "Book" AS b ON b.id = t."bookId"
         LEFT JOIN "User" AS u ON u.email = t."userEmail"
         ORDER BY t."createdAt" DESC`
    );
  return result.rows.map((thread: CommunityThreadRow) => ({
    id: thread.id,
    content: thread.content,
    bookId: thread.bookId,
    kind: thread.kind,
    createdAt: thread.createdAt,
    linkedBook: thread.bookId
      ? {
          id: thread.bookId,
          title: thread.bookTitle ?? "関連する本",
          thumbnail: thread.bookThumbnail ?? null,
        }
      : null,
    nickname: thread.nickname ?? null,
    authorAvatarUrl: thread.authorAvatarUrl ?? null,
  }));
}
