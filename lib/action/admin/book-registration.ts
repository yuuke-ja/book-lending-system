"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { rebuildBookEmbeddings } from "@/app/api/admin/book-embeddings/book-embedding";
import { db } from "@/lib/db";
import { classifyBooks } from "@/lib/tags/classify-books";
import { requireAdmin } from "./require-admin";
import type { AdminActionResult } from "./result";

type SavedBookRow = {
  id: string;
  title: string;
  authors: string[] | null;
  description: string | null;
};

export async function registerPendingBooks(): Promise<
  AdminActionResult<{ embeddingCount: number }>
> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;

  try {
    const pending = await db.query(`SELECT * FROM "PendingBook"`);
    const savedBookIds: string[] = [];

    await db.transaction(async (tx) => {
      for (const pendingBook of pending.rows) {
        const savedBook = await tx.query<SavedBookRow>(
          `INSERT INTO "Book" (id, "googleBookId", isbn13, title, authors, description, thumbnail)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (isbn13)
           DO UPDATE SET
             "googleBookId" = EXCLUDED."googleBookId",
             title = EXCLUDED.title,
             authors = EXCLUDED.authors,
             description = EXCLUDED.description,
             thumbnail = EXCLUDED.thumbnail
           RETURNING id, title, authors, description`,
          [
            randomUUID(),
            pendingBook.googleBookId,
            pendingBook.isbn13,
            pendingBook.title,
            pendingBook.authors,
            pendingBook.description,
            pendingBook.thumbnail,
          ]
        );
        savedBookIds.push(savedBook.rows[0].id);
      }

      await tx.query(`DELETE FROM "PendingBook"`);
    });

    const embeddingCount = await rebuildBookEmbeddings(savedBookIds);
    await classifyBooks({ bookIds: savedBookIds });

    revalidatePath("/admin/registration");
    revalidatePath("/admin/books");
    revalidatePath("/book-list");

    return {
      ok: true,
      status: 200,
      message: "本登録が完了しました",
      data: { embeddingCount },
    };
  } catch (error) {
    console.error("本登録に失敗:", error);
    return { ok: false, status: 500, error: "本登録に失敗しました" };
  }
}
