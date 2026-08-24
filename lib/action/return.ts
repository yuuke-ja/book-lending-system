"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type ReturnBookResult =
  | { ok: true; status: 200; message: string }
  | {
    ok: false;
    status: 400 | 401 | 404 | 500;
    error: string;
  };

export async function returnBook(bookId: unknown): Promise<ReturnBookResult> {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return { ok: false, status: 401, error: "認証が必要です" };
  }
  if (typeof bookId !== "string" || bookId === "") {
    return { ok: false, status: 400, error: "bookIdが不正です" };
  }

  try {
    const updated = await db.query(
      `UPDATE "Loan"
       SET "returnedAt" = $1
       WHERE "bookId" = $2
         AND "userEmail" = $3
         AND "returnedAt" IS NULL`,
      [new Date(), bookId, userEmail]
    );

    if ((updated.rowCount ?? 0) === 0) {
      return {
        ok: false,
        status: 404,
        error: "返却する貸出が見つかりません",
      };
    }

    revalidatePath("/");
    revalidatePath("/book-list");

    return { ok: true, status: 200, message: "返却が完了しました" };
  } catch (error) {
    console.error("返却に失敗:", error);
    return { ok: false, status: 500, error: "返却に失敗しました" };
  }
}
