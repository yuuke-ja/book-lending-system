import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!session.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { bookId } = body;
    if (!bookId || typeof bookId !== "string") {
      return new Response("bookIdが不正です", { status: 400 });
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
      return new Response("返却する貸出が見つかりません", { status: 404 });
    }


    return Response.json(
      { ok: true, mock: true, message: "返却が完了しました" },
      { status: 200 }
    );
  } catch (error) {
    return new Response("返却に失敗しました", { status: 500 });
  }
}
