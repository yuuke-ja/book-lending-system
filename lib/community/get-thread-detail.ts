import { db } from "@/lib/db";
import type {
  LinkedBook,
  ThreadDetail,
  ThreadDetailWithOwnership,
} from "@/lib/community/types";

type ThreadRow = {
  id: string;
  content: string;
  bookId: string | null;
  kind: string;
  createdAt: string;
  userEmail: string;
  nickname: string | null;
  authorAvatarUrl: string | null;
};

type CommentRow = {
  id: string;
  threadId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  deletedAt: string | Date | null;
  userEmail: string;
  nickname: string | null;
  authorAvatarUrl: string | null;
};

type CommentBookRow = {
  commentId: string;
  id: string;
  title: string;
  thumbnail: string | null;
};

export function getThreadDetail(threadId: string): Promise<ThreadDetail | null>;
export function getThreadDetail(
  threadId: string,
  currentUserEmail: string | null
): Promise<ThreadDetailWithOwnership | null>;
export async function getThreadDetail(
  threadId: string,
  currentUserEmail?: string | null
): Promise<ThreadDetail | ThreadDetailWithOwnership | null> {
  const threadResult = await db.query<ThreadRow>(
    `SELECT
       t.id,
       t.content,
       t."bookId" AS "bookId",
       t.kind,
       t."createdAt" AS "createdAt",
       t."userEmail" AS "userEmail",
       u.nickname AS nickname,
       u.avatarurl AS "authorAvatarUrl"
     FROM "Thread" t
     LEFT JOIN "User" u ON u.email = t."userEmail"
     WHERE t.id = $1
       AND t."deletedAt" IS NULL
     LIMIT 1`,
    [threadId]
  );

  if ((threadResult.rowCount ?? 0) === 0) {
    return null;
  }

  const thread = threadResult.rows[0];

  const linkedThreadBookResult = thread.bookId
    ? await db.query<LinkedBook>(
        `SELECT id, title, thumbnail
           FROM "Book"
           WHERE id = $1
           LIMIT 1`,
        [thread.bookId]
      )
    : null;

  const commentResult = await db.query<CommentRow>(
    `SELECT
       c.id,
       c."threadId" AS "threadId",
       c."parentCommentId" AS "parentCommentId",
       c.content,
       c."createdAt" AS "createdAt",
       c."deletedAt" AS "deletedAt",
       c."userEmail" AS "userEmail",
       u.nickname AS nickname,
       u.avatarurl AS "authorAvatarUrl"
     FROM "ThreadComment" c
     LEFT JOIN "User" u ON u.email = c."userEmail"
     WHERE c."threadId" = $1
     ORDER BY c."createdAt" ASC`,
    [threadId]
  );

  const commentIds = commentResult.rows.map((comment) => comment.id);
  const commentBookResult =
    commentIds.length > 0
      ? await db.query<CommentBookRow>(
          `SELECT
             cbl."commentId" AS "commentId",
             b.id,
             b.title,
             b.thumbnail
           FROM "CommentBookLink" cbl
           INNER JOIN "Book" b ON b.id = cbl."bookId"
           WHERE cbl."commentId" = ANY($1::text[])
           ORDER BY cbl."createdAt" ASC`,
          [commentIds]
        )
      : { rows: [] };

  const linkedBooksByCommentId = commentBookResult.rows.reduce<Record<string, LinkedBook[]>>(
    (acc, row) => {
      if (!acc[row.commentId]) {
        acc[row.commentId] = [];
      }

      acc[row.commentId].push({
        id: row.id,
        title: row.title,
        thumbnail: row.thumbnail,
      });

      return acc;
    },
    {}
  );

  return {
    thread: {
      id: thread.id,
      content: thread.content,
      bookId: thread.bookId,
      kind: thread.kind,
      createdAt: thread.createdAt,
      nickname: thread.nickname,
      authorAvatarUrl: thread.authorAvatarUrl,
      linkedBook: linkedThreadBookResult?.rows[0] ?? null,
      ...(currentUserEmail !== undefined
        ? { isOwner: thread.userEmail === currentUserEmail }
        : {}),
    },
    comments: commentResult.rows.map((comment) => ({
      id: comment.id,
      threadId: comment.threadId,
      parentCommentId: comment.parentCommentId,
      content: comment.content,
      createdAt: comment.createdAt,
      nickname: comment.nickname,
      authorAvatarUrl: comment.authorAvatarUrl,
      linkedBooks: linkedBooksByCommentId[comment.id] ?? [],
      ...(currentUserEmail !== undefined
        ? {
            isOwner: comment.userEmail === currentUserEmail,
            isDeleted: comment.deletedAt != null,
          }
        : {}),
    })),
  };
}
