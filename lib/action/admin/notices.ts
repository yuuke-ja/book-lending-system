"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "./require-admin";
import type { AdminActionResult } from "./result";

type CreatedNotice = {
  id: string;
  title: string;
  content: unknown;
  bookId: string | null;
  createdAt: string;
};

export async function createNotice(
  input: unknown
): Promise<AdminActionResult<CreatedNotice>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;

  try {
    if (typeof input !== "object" || input === null) {
      return { ok: false, status: 400, error: "リクエストが不正です" };
    }

    const { title, content, bookId } = input as Record<string, unknown>;
    if (typeof title !== "string" || title.trim() === "") {
      return {
        ok: false,
        status: 400,
        error: "タイトルを入力してください",
      };
    }
    if (
      !content ||
      typeof content !== "object" ||
      (content as { type?: unknown }).type !== "doc"
    ) {
      return { ok: false, status: 400, error: "本文を入力してください" };
    }
    if (bookId != null && typeof bookId !== "string") {
      return { ok: false, status: 400, error: "bookIdが不正です" };
    }

    const normalizedBookId =
      typeof bookId === "string" && bookId.trim() !== ""
        ? bookId.trim()
        : null;

    if (normalizedBookId) {
      const bookResult = await db.query(
        `SELECT 1 FROM "Book" WHERE id = $1 LIMIT 1`,
        [normalizedBookId]
      );
      if ((bookResult.rowCount ?? 0) === 0) {
        return { ok: false, status: 404, error: "本が見つかりません" };
      }
    }

    const result = await db.query<CreatedNotice>(
      `INSERT INTO "Notice" (title, content, "bookId")
       VALUES ($1, $2::jsonb, $3)
       RETURNING id, title, content, "bookId", "createdAt"`,
      [title.trim(), JSON.stringify(content), normalizedBookId]
    );

    revalidatePath("/admin/notices");
    return {
      ok: true,
      status: 201,
      message: "お知らせが保存されました",
      data: result.rows[0],
    };
  } catch (error) {
    console.error("お知らせの作成に失敗:", error);
    return {
      ok: false,
      status: 500,
      error: "お知らせの作成に失敗しました",
    };
  }
}

export async function deleteNotice(
  noticeId: unknown
): Promise<AdminActionResult> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;

  if (typeof noticeId !== "string" || noticeId.trim() === "") {
    return { ok: false, status: 400, error: "noticeIdが不正です" };
  }

  try {
    const result = await db.query(`DELETE FROM "Notice" WHERE id = $1`, [
      noticeId,
    ]);
    if ((result.rowCount ?? 0) === 0) {
      return {
        ok: false,
        status: 404,
        error: "お知らせが見つかりません",
      };
    }

    revalidatePath("/admin/notices");
    return {
      ok: true,
      status: 200,
      message: "お知らせを削除しました",
    };
  } catch (error) {
    console.error("お知らせの削除に失敗:", error);
    return {
      ok: false,
      status: 500,
      error: "お知らせの削除に失敗しました",
    };
  }
}
