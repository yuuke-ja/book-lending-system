"use server";

import { revalidatePath } from "next/cache";
import { classifyBooks } from "@/lib/tags/classify-books";
import { requireAdmin } from "./require-admin";
import type { AdminActionResult } from "./result";

export async function classifyAllBooks(): Promise<
  AdminActionResult<{ count: number }>
> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;

  try {
    const rows = await classifyBooks();
    revalidatePath("/admin/books");
    revalidatePath("/book-list");
    return {
      ok: true,
      status: 200,
      message: "全タグを付け直しました",
      data: { count: rows.length },
    };
  } catch (error) {
    console.error("全タグの自動付与に失敗:", error);
    return {
      ok: false,
      status: 500,
      error: "全タグの付け直しに失敗しました",
    };
  }
}

export async function classifyBooksForTag(
  tagId: unknown
): Promise<AdminActionResult<{ count: number }>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;

  if (typeof tagId !== "string" || tagId.trim() === "") {
    return { ok: false, status: 400, error: "tagIdが不正です" };
  }

  try {
    const rows = await classifyBooks({ tagIds: [tagId.trim()] });
    revalidatePath("/admin/books");
    revalidatePath("/book-list");
    return {
      ok: true,
      status: 200,
      message: "タグを付け直しました",
      data: { count: rows.length },
    };
  } catch (error) {
    console.error("タグの自動付与に失敗:", error);
    return {
      ok: false,
      status: 500,
      error: "タグの付け直しに失敗しました",
    };
  }
}
