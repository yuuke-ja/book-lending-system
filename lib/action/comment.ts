"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { summary } from "@/lib/ai/aiSummary";

export type CreateCommentResult =
  | { ok: true; status: 200; message: string }
  | {
      ok: false;
      status: 400 | 401 | 404 | 500;
      error: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function createComment(
  input: unknown
): Promise<CreateCommentResult> {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return { ok: false, status: 401, error: "認証が必要です" };
  }

  if (!isRecord(input)) {
    return { ok: false, status: 400, error: "threadIdが不正です" };
  }

  if (typeof input.threadId !== "string" || input.threadId.trim() === "") {
    return { ok: false, status: 400, error: "threadIdが不正です" };
  }
  const threadId = input.threadId.trim();

  if (
    input.parentCommentId != null &&
    (typeof input.parentCommentId !== "string" ||
      input.parentCommentId.trim() === "")
  ) {
    return { ok: false, status: 400, error: "parentCommentIdが不正です" };
  }
  const parentCommentId = input.parentCommentId?.trim() ?? null;

  if (typeof input.content !== "string" || input.content.trim() === "") {
    return { ok: false, status: 400, error: "contentが不正です" };
  }
  const content = input.content.trim();

  if (
    input.bookIds != null &&
    (!Array.isArray(input.bookIds) ||
      input.bookIds.some(
        (bookId: unknown) =>
          typeof bookId !== "string" || bookId.trim() === ""
      ))
  ) {
    return { ok: false, status: 400, error: "bookIdsが不正です" };
  }
  const bookIds = Array.isArray(input.bookIds)
    ? Array.from(
        new Set(input.bookIds.map((bookId: string) => bookId.trim()))
      )
    : [];

  try {
    const threadResult = await db.query(
      `SELECT id
       FROM "Thread"
       WHERE id = $1
       LIMIT 1`,
      [threadId]
    );

    if ((threadResult.rowCount ?? 0) === 0) {
      return { ok: false, status: 404, error: "スレッドが見つかりません" };
    }

    if (parentCommentId) {
      const parentCommentResult = await db.query(
        `SELECT id, "threadId"
         FROM "ThreadComment"
         WHERE id = $1
         LIMIT 1`,
        [parentCommentId]
      );

      if ((parentCommentResult.rowCount ?? 0) === 0) {
        return { ok: false, status: 404, error: "親コメントが見つかりません" };
      }

      if (parentCommentResult.rows[0]?.threadId !== threadId) {
        return {
          ok: false,
          status: 400,
          error: "親コメントのthreadIdが一致しません",
        };
      }
    }

    if (bookIds.length > 0) {
      const booksResult = await db.query(
        `SELECT id
         FROM "Book"
         WHERE id = ANY($1::text[])`,
        [bookIds]
      );

      if ((booksResult.rowCount ?? 0) !== bookIds.length) {
        return {
          ok: false,
          status: 404,
          error: "存在しない本が含まれています",
        };
      }
    }

    const savedComment = await db.transaction(async (tx) => {
      const commentResult = await tx.query<{
        id: string;
        updatedAt: string;
      }>(
        `INSERT INTO "ThreadComment" ("threadId", "parentCommentId", "userEmail", content)
         VALUES ($1, $2, $3, $4)
         RETURNING id, "updatedAt"`,
        [threadId, parentCommentId, userEmail, content]
      );

      const commentId = commentResult.rows[0]?.id;
      if (!commentId) {
        throw new Error("comment insert failed");
      }

      if (bookIds.length > 0) {
        await tx.query(
          `INSERT INTO "CommentBookLink" ("commentId", "bookId")
           SELECT $1, unnest($2::text[])`,
          [commentId, bookIds]
        );
      }

      return {
        id: commentId,
        updatedAt: commentResult.rows[0].updatedAt,
      };
    });

    if (content.length >= 500) {
      await summary({
        sourceType: "comment",
        sourceId: savedComment.id,
        content,
        updatedAt: savedComment.updatedAt,
      });
    }

    return { ok: true, status: 200, message: "コメントを投稿しました" };
  } catch (error) {
    console.error("コメントの作成に失敗:", error);
    return {
      ok: false,
      status: 500,
      error: "コメントの作成に失敗しました",
    };
  }
}

export async function deleteComment(commentId: string) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return { ok: false, status: 401, error: "認証が必要です" };
  }

  try {
    const res = await db.query(
      `UPDATE "ThreadComment"
       SET "deletedAt" = NOW()
       WHERE id = $1
         AND "userEmail" = $2
         AND "deletedAt" IS NULL
       RETURNING id`,
      [commentId, userEmail]
    );

    if ((res.rowCount ?? 0) === 0) {
      return {
        ok: false,
        status: 404,
        error: "コメントが見つからないか、削除する権限がありません",
      };
    }

    return { ok: true, status: 200, message: "コメントを削除しました" };
  } catch (error) {
    console.error("コメントの削除に失敗:", error);
    return {
      ok: false,
      status: 500,
      error: "コメントの削除に失敗しました",
    };
  }
}
