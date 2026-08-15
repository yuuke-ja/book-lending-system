"use server";

import { revalidatePath } from "next/cache";
import { rebuildBookEmbeddings } from "@/app/api/admin/book-embeddings/book-embedding";
import { db } from "@/lib/db";
import { requireAdmin } from "./require-admin";
import type { AdminActionResult } from "./result";

export async function updateBookTags(
  input: unknown
): Promise<AdminActionResult<{ embeddingCount: number }>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;
  if (typeof input !== "object" || input === null) {
    return { ok: false, status: 400, error: "bookIdまたはtagsが不正です" };
  }

  const data = input as Record<string, unknown>;
  if (
    typeof data.bookId !== "string" ||
    data.bookId.trim() === "" ||
    !Array.isArray(data.tags) ||
    !data.tags.every((tag) => typeof tag === "string")
  ) {
    return { ok: false, status: 400, error: "bookIdまたはtagsが不正です" };
  }

  const bookId = data.bookId;
  const tags = Array.from(new Set(data.tags));

  try {
    await db.transaction(async (tx) => {
      await tx.query(`DELETE FROM "BookTag" WHERE "bookId" = $1`, [bookId]);
      if (tags.length > 0) {
        await tx.query(
          `INSERT INTO "BookTag" ("bookId", "tagId")
           SELECT $1, id FROM "TagList" WHERE id = ANY($2::text[])`,
          [bookId, tags]
        );
      }
    });

    const embeddingCount = await rebuildBookEmbeddings([bookId]);
    revalidatePath(`/admin/books/${bookId}`);
    return {
      ok: true,
      status: 200,
      message: "タグの更新が完了しました",
      data: { embeddingCount },
    };
  } catch (error) {
    console.error(error);
    return { ok: false, status: 500, error: "タグの更新に失敗しました" };
  }
}
