import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;
  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get("bookId");
  if (!bookId) {
    return NextResponse.json({ error: "bookIdが必要です" }, { status: 400 });
  }

  try {
    const [userReviewResult, commentsResult] = await Promise.all([
      db.query(
        `SELECT id, "bookId", "userEmail", rating, comment, "createdAt", "updatedAt"
         FROM "BookReview"
         WHERE "bookId" = $1
           AND "userEmail" = $2
         LIMIT 1`,
        [bookId, userEmail]
      ),
      db.query(
        `SELECT id, "bookId", rating, comment, "createdAt", "updatedAt"
         FROM "BookReview"
         WHERE "bookId" = $1
           AND comment IS NOT NULL
           AND BTRIM(comment) <> ''
         ORDER BY "createdAt" DESC`,
        [bookId]
      ),
    ]);

    return NextResponse.json(
      {
        userReview: userReviewResult.rows[0] ?? null,
        comments: commentsResult.rows,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("レビュー取得に失敗:", error);
    return NextResponse.json({ error: "レビュー取得に失敗しました" }, { status: 500 });
  }
}
