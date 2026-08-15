"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type ReviewInput = {
  bookId?: unknown;
  rating?: unknown;
  comment?: unknown;
};

type SaveBookReviewResult =
  | {
      ok: true;
      status: 200;
      message: string;
      data: Record<string, unknown>;
    }
  | {
      ok: false;
      status: 400 | 401 | 404 | 500;
      error: string;
    };

export async function saveBookReview(
  input: unknown
): Promise<SaveBookReviewResult> {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return { ok: false, status: 401, error: "認証が必要です" };
  }

  const body: ReviewInput =
    typeof input === "object" && input !== null ? input : {};

  if (!body.bookId || typeof body.bookId !== "string") {
    return { ok: false, status: 400, error: "bookIdが不正です" };
  }
  const bookId = body.bookId;

  if (
    typeof body.rating !== "number" ||
    !Number.isInteger(body.rating) ||
    body.rating < 1 ||
    body.rating > 5
  ) {
    return {
      ok: false,
      status: 400,
      error: "星は1から5の整数でなければなりません",
    };
  }
  const rating = body.rating;

  if (body.comment != null && typeof body.comment !== "string") {
    return {
      ok: false,
      status: 400,
      error: "本文は文字列でなければなりません",
    };
  }
  const comment = body.comment ?? null;

  try {
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

    const savedReview = await db.query(
      `INSERT INTO "BookReview" ("userEmail", "bookId", rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("bookId", "userEmail")
       DO UPDATE SET
         rating = EXCLUDED.rating,
         comment = EXCLUDED.comment,
         "updatedAt" = NOW()
       RETURNING id, "userEmail", "bookId", rating, comment, "createdAt", "updatedAt"`,
      [userEmail, bookId, rating, comment]
    );

    return {
      ok: true,
      status: 200,
      message: "レビューを保存しました",
      data: savedReview.rows[0],
    };
  } catch (error) {
    console.error("レビューの保存に失敗:", error);
    return {
      ok: false,
      status: 500,
      error: "レビューの保存に失敗しました",
    };
  }
}
