"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { summary } from "@/lib/ai/aiSummary";

type ThreadKind = "BOOK_TOPIC" | "BOOK_REQUEST";

type CreatedThread = {
  id: string;
  content: string;
  bookId: string | null;
  kind: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateThreadResult =
  | { ok: true; status: 200; message: string }
  | {
      ok: false;
      status: 400 | 401 | 404 | 500;
      error: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function createThread(
  input: unknown
): Promise<CreateThreadResult> {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return { ok: false, status: 401, error: "認証が必要です" };
  }

  if (!isRecord(input)) {
    return { ok: false, status: 400, error: "kindが不正です" };
  }

  if (input.kind !== "BOOK_TOPIC" && input.kind !== "BOOK_REQUEST") {
    return { ok: false, status: 400, error: "kindが不正です" };
  }
  const kind: ThreadKind = input.kind;

  if (input.bookId != null && typeof input.bookId !== "string") {
    return { ok: false, status: 400, error: "bookIdが不正です" };
  }
  const bookId = input.bookId ?? null;

  if (typeof input.content !== "string" || input.content.trim() === "") {
    return { ok: false, status: 400, error: "contentが不正です" };
  }
  const content = input.content.trim();

  if (kind === "BOOK_TOPIC" && !bookId) {
    return {
      ok: false,
      status: 400,
      error: "本に紐づく投稿にはbookIdが必要です",
    };
  }

  try {
    if (bookId) {
      const bookResult = await db.query(
        `SELECT 1
         FROM "Book"
         WHERE id = $1
         LIMIT 1`,
        [bookId]
      );

      if ((bookResult.rowCount ?? 0) === 0) {
        return { ok: false, status: 404, error: "本が見つかりません" };
      }
    }

    const threadResult = await db.query<CreatedThread>(
      `INSERT INTO "Thread" (kind, "bookId", "userEmail", content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, content, "bookId", kind, "createdAt", "updatedAt"`,
      [kind, bookId, userEmail, content]
    );

    const thread = threadResult.rows[0];
    if (!thread) {
      throw new Error("thread insert failed");
    }

    if (content.length >= 800) {
      await summary({
        sourceType: "thread",
        sourceId: thread.id,
        content,
        updatedAt: thread.updatedAt,
      });
    }

    return {
      ok: true,
      status: 200,
      message: "投稿を作成しました",
    };
  } catch (error) {
    console.error("スレッドの作成に失敗:", error);
    return {
      ok: false,
      status: 500,
      error: "スレッドの作成に失敗しました",
    };
  }
}
