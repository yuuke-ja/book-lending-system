"use server";

import { revalidatePath } from "next/cache";
import {
  createMissingBookEmbeddings,
  rebuildBookEmbeddings,
} from "@/app/api/admin/book-embeddings/book-embedding";
import { db } from "@/lib/db";
import { requireAdmin } from "./require-admin";
import type { AdminActionResult } from "./result";

export async function createMissingEmbeddings(): Promise<
  AdminActionResult<{ count: number }>
> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;

  try {
    const count = await createMissingBookEmbeddings();
    revalidatePath("/admin/books");
    return {
      ok: true,
      status: 200,
      message: `${count}件更新しました`,
      data: { count },
    };
  } catch (error) {
    console.error("未作成Embeddingの生成に失敗:", error);
    return { ok: false, status: 500, error: "更新に失敗しました" };
  }
}

export async function rebuildAllEmbeddings(): Promise<
  AdminActionResult<{ count: number }>
> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;

  try {
    const books = await db.query<{ id: string }>(`SELECT id FROM "Book"`);
    const count = await rebuildBookEmbeddings(books.rows.map((book) => book.id));
    revalidatePath("/admin/books");
    return {
      ok: true,
      status: 200,
      message: `${count}件更新しました`,
      data: { count },
    };
  } catch (error) {
    console.error("Embeddingの全再構築に失敗:", error);
    return { ok: false, status: 500, error: "更新に失敗しました" };
  }
}
