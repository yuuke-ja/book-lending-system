import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { bookId } = body;
    if (!bookId || typeof bookId !== "string") {
      return NextResponse.json({ error: "bookIdが不正です" }, { status: 400 });
    }
    const updated = await db.query(
      `UPDATE "Loan"
       SET "returnedAt" = $1
       WHERE "bookId" = $2
         AND "userEmail" = $3
         AND "returnedAt" IS NULL`,
      [new Date(), bookId, session.user.email]
    );
    if ((updated.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "返却する貸出が見つかりません" }, { status: 404 });
    }


    return NextResponse.json(
      { ok: true, mock: true, message: "返却が完了しました" },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "返却に失敗しました" }, { status: 500 });
  }
}
