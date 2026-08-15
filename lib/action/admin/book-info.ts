"use server";

import { revalidatePath } from "next/cache";
import { rebuildBookEmbeddings } from "@/app/api/admin/book-embeddings/book-embedding";
import { db } from "@/lib/db";
import { classifyBooks } from "@/lib/tags/classify-books";
import { requireAdmin } from "./require-admin";
import type { AdminActionResult } from "./result";

export async function updateBookInfo(
  input: unknown
): Promise<AdminActionResult<{ embeddingCount: number }>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;

  if (typeof input !== "object" || input === null) {
    return { ok: false, status: 400, error: "入力が不正です" };
  }

  const data = input as Record<string, unknown>;
  const bookId = typeof data.bookId === "string" ? data.bookId.trim() : "";
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const description =
    typeof data.description === "string" ? data.description : "";

  if (!bookId) return { ok: false, status: 400, error: "bookIdがない" };
  if (!title) return { ok: false, status: 400, error: "タイトルがない" };

  try {
    const result = await db.query(
      `UPDATE "Book"
       SET title = $1, description = $2
       WHERE id = $3`,
      [title, description || null, bookId]
    );
    if ((result.rowCount ?? 0) === 0) {
      return { ok: false, status: 404, error: "本が見つかりません" };
    }

    const embeddingCount = await rebuildBookEmbeddings([bookId]);
    await classifyBooks({ bookIds: [bookId] });
    revalidatePath(`/admin/books/${bookId}`);

    return {
      ok: true,
      status: 200,
      message: "本の情報を更新しました",
      data: { embeddingCount },
    };
  } catch (error) {
    console.error("本情報更新エラー:", error);
    return {
      ok: false,
      status: 500,
      error: "本の情報更新に失敗しました",
    };
  }
}
