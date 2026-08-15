"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "./require-admin";
import type { AdminActionResult } from "./result";

const ISBN13_REGEX = /^(97[89]|491)\d{10}$/;

type PendingBookRow = {
  id: string;
  googleBookId: string | null;
  isbn13: string;
  title: string;
  authors: string[];
  description: string | null;
  thumbnail: string | null;
};

export async function createPendingBook(
  input: unknown
): Promise<AdminActionResult<PendingBookRow>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;
  if (typeof input !== "object" || input === null) {
    return { ok: false, status: 400, error: "Invalid request" };
  }

  const data = input as Record<string, unknown>;
  const isString = (value: unknown): value is string =>
    typeof value === "string";
  const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(isString);
  const googleBookId = isString(data.googleBookId) ? data.googleBookId : null;
  const isbn13 = isString(data.isbn13) ? data.isbn13 : "";
  const title = isString(data.title) ? data.title : "";
  const authors = isStringArray(data.authors) ? data.authors : [];
  const description = isString(data.description) ? data.description : null;
  const thumbnail = isString(data.thumbnail) ? data.thumbnail : null;

  if (!isbn13 || !ISBN13_REGEX.test(isbn13)) {
    return { ok: false, status: 400, error: "Invalid isbn13" };
  }
  if (!title) {
    return { ok: false, status: 400, error: "Invalid title" };
  }

  try {
    const existing = await db.query(
      `SELECT id FROM "PendingBook" WHERE isbn13 = $1 LIMIT 1`,
      [isbn13]
    );
    const pendingBook = await db.query<PendingBookRow>(
      `INSERT INTO "PendingBook" (id, "googleBookId", isbn13, title, authors, description, thumbnail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (isbn13)
       DO UPDATE SET
         "googleBookId" = EXCLUDED."googleBookId",
         title = EXCLUDED.title,
         authors = EXCLUDED.authors,
         description = EXCLUDED.description,
         thumbnail = EXCLUDED.thumbnail
       RETURNING *`,
      [
        randomUUID(),
        googleBookId,
        isbn13,
        title,
        authors,
        description,
        thumbnail,
      ]
    );
    const status = (existing.rowCount ?? 0) > 0 ? 200 : 201;
    revalidatePath("/admin/registration");
    return {
      ok: true,
      status,
      message: "仮登録しました",
      data: pendingBook.rows[0],
    };
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      status: 500,
      error: "Failed to create pending book",
    };
  }
}

export async function deletePendingBook(id: unknown): Promise<AdminActionResult> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;
  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, status: 400, error: "Invalid ID" };
  }

  try {
    const deleted = await db.query(
      `DELETE FROM "PendingBook" WHERE id = $1 RETURNING id`,
      [id]
    );
    if ((deleted.rowCount ?? 0) === 0) {
      return { ok: false, status: 404, error: "Pending book not found" };
    }
    revalidatePath("/admin/registration");
    return { ok: true, status: 200, message: "Pending book deleted" };
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      status: 500,
      error: "Failed to delete pending book",
    };
  }
}
