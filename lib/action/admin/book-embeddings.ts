"use server";

import { revalidatePath } from "next/cache";
import {
  createMissingBookEmbeddings,
  rebuildBookEmbeddings,
} from "@/app/api/admin/book-embeddings/book-embedding";
import { db } from "@/lib/db";
import {
  testBookEmbeddings,
  type EmbeddingTestMode,
  type EmbeddingTestResult,
} from "@/lib/ai/embedding-test";
import { requireAdmin } from "./require-admin";
import type { AdminActionResult } from "./result";

type EmbeddingTestInput = {
  mode?: unknown;
  query?: unknown;
  bookId?: unknown;
  limit?: unknown;
};

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

export async function runEmbeddingTest(
  input: unknown
): Promise<AdminActionResult<{ mode: EmbeddingTestMode; results: EmbeddingTestResult[] }>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;

  const body: EmbeddingTestInput =
    typeof input === "object" && input !== null ? input : {};
  const mode: EmbeddingTestMode = body.mode === "book" ? "book" : "query";
  const limit = Number(body.limit ?? 10);

  if (!Number.isFinite(limit) || limit < 1 || limit > 50) {
    return {
      ok: false,
      status: 400,
      error: "表示件数は1〜50で指定してください",
    };
  }

  try {
    const results = await testBookEmbeddings({
      mode,
      query: typeof body.query === "string" ? body.query : undefined,
      bookId: typeof body.bookId === "string" ? body.bookId : undefined,
      limit,
    });

    return {
      ok: true,
      status: 200,
      message: "Embedding精度テストが完了しました",
      data: { mode, results },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ベクトル検索に失敗しました";
    const isInputError =
      message === "検索語を入力してください" ||
      message === "基準にする本を選択してください" ||
      message === "選択した本のEmbeddingがありません";

    console.error("Embedding精度テストに失敗:", error);
    return {
      ok: false,
      status: isInputError ? 400 : 500,
      error: message,
    };
  }
}
