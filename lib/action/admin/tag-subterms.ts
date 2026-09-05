"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "./require-admin";
import type { AdminActionResult } from "./result";

type TagSubtermRow = {
  id: string;
  tagId: string;
  subterm: string;
};

export async function createTagSubterms(
  tagId: unknown,
  input: unknown
): Promise<AdminActionResult<TagSubtermRow[]>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;
  if (typeof tagId !== "string" || tagId.trim() === "") {
    return { ok: false, status: 400, error: "tagIdが不正です" };
  }
  if (
    !Array.isArray(input) ||
    !input.every((subterm) => typeof subterm === "string")
  ) {
    return { ok: false, status: 400, error: "子要素の形式が不正です" };
  }
  const subterms = input.map((subterm) => subterm.trim()).filter(Boolean);
  if (subterms.length === 0) {
    return { ok: false, status: 400, error: "子要素の形式が不正です" };
  }

  try {
    await db.query(
      `INSERT INTO "TagSubterm" ("tagId", subterm)
       SELECT $1, trim(subterm)
       FROM unnest($2::text[]) AS input(subterm)
       WHERE trim(subterm) <> ''
       ON CONFLICT ("tagId", subterm) DO UPDATE
       SET "updatedAt" = now()`,
      [tagId, subterms]
    );
    const result = await db.query<TagSubtermRow>(
      `SELECT id, "tagId", subterm
       FROM "TagSubterm"
       WHERE "tagId" = $1
       ORDER BY subterm ASC`,
      [tagId]
    );
    revalidatePath("/admin/tags");
    return {
      ok: true,
      status: 201,
      message: "子要素を保存しました",
      data: result.rows,
    };
  } catch (error) {
    console.error(error);
    return { ok: false, status: 500, error: "子要素の保存に失敗しました" };
  }
}

export async function deleteTagSubterm(
  tagId: unknown,
  subtermId: unknown
): Promise<AdminActionResult> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;
  if (typeof tagId !== "string" || tagId.trim() === "") {
    return { ok: false, status: 400, error: "tagIdが不正です" };
  }
  if (typeof subtermId !== "string" || subtermId.trim() === "") {
    return { ok: false, status: 400, error: "subtermIdが不正です" };
  }

  try {
    const result = await db.query(
      `DELETE FROM "TagSubterm" WHERE id = $1 AND "tagId" = $2`,
      [subtermId, tagId]
    );
    if ((result.rowCount ?? 0) === 0) {
      return {
        ok: false,
        status: 404,
        error: "子要素が見つかりません",
      };
    }
    revalidatePath("/admin/tags");
    return { ok: true, status: 200, message: "子要素を削除しました" };
  } catch (error) {
    console.error(error);
    return { ok: false, status: 500, error: "子要素の削除に失敗しました" };
  }
}
