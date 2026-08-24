"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "./require-admin";
import type { AdminActionResult } from "./result";

type TagRow = {
  id: string;
  tag: string;
  inserted?: boolean;
};

export async function createTags(
  input: unknown
): Promise<AdminActionResult<TagRow[]>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;

  if (!Array.isArray(input) || !input.every((tag) => typeof tag === "string")) {
    return { ok: false, status: 400, error: "Invalid tags" };
  }
  const tags = input.map((tag) => tag.trim()).filter(Boolean);
  if (tags.length === 0) {
    return { ok: false, status: 400, error: "Invalid tags" };
  }

  try {
    const result = await db.query<TagRow>(
      `INSERT INTO "TagList" (tag)
       SELECT DISTINCT trim(tag)
       FROM unnest($1::text[]) AS input(tag)
       WHERE trim(tag) <> ''
       ON CONFLICT (tag) DO UPDATE
       SET "updatedAt" = now()
       RETURNING *, (xmax = 0) AS inserted`,
      [tags]
    );
    const status = result.rows.some((row) => row.inserted) ? 201 : 200;
    revalidatePath("/admin/tags");
    return {
      ok: true,
      status,
      message: "ジャンルを保存しました",
      data: result.rows,
    };
  } catch (error) {
    console.error(error);
    return { ok: false, status: 500, error: "Failed to create tag" };
  }
}

export async function deleteTag(tagId: unknown): Promise<AdminActionResult> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;
  if (typeof tagId !== "string" || tagId.trim() === "") {
    return { ok: false, status: 400, error: "tagIdが不正です" };
  }

  try {
    await db.query(`DELETE FROM "TagList" WHERE id = $1`, [tagId]);
    revalidatePath("/admin/tags");
    return { ok: true, status: 200, message: "ジャンルを削除しました" };
  } catch (error) {
    console.error(error);
    return { ok: false, status: 500, error: "ジャンルの削除に失敗しました" };
  }
}
