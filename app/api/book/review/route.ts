import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type ReviewBody = {
  bookId?: unknown;
  rating?: unknown;
  comment?: unknown;
};

export async function GET(request: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get("bookId");
  if (!bookId) {
    return NextResponse.json({ error: "bookId is required" }, { status: 400 });
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
  } catch {
    return NextResponse.json({ error: "レビュー取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ReviewBody;

    if (!body.bookId || typeof body.bookId !== "string") {
      return NextResponse.json({ error: "bookIdが不正です" }, { status: 400 });
    }
    const bookId = body.bookId;

    if (
      typeof body.rating !== "number" ||
      !Number.isInteger(body.rating) ||
      body.rating < 1 ||
      body.rating > 5
    ) {
      return NextResponse.json({ error: "星は1から5の整数でなければなりません" }, { status: 400 });
    }
    const rating = body.rating;

    if (body.comment != null && typeof body.comment !== "string") {
      return NextResponse.json({ error: "本文は文字列でなければなりません" }, { status: 400 });
    }
    const comment = body.comment ?? null;

    const bookResult = await db.query(
      `SELECT 1
       FROM "Book"
       WHERE id = $1
       LIMIT 1`,
      [bookId]
    );
    if ((bookResult.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "本が見つかりません" }, { status: 404 });
    }

    const savedReview = await db.query(
      `INSERT INTO "BookReview" ("userEmail", "bookId", rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("bookId", "userEmail")
       DO UPDATE SET
         rating = EXCLUDED.rating,
         comment = EXCLUDED.comment,
         "updatedAt" = NOW()
       RETURNING id, "userEmail", "bookId", rating, comment, "createdAt", "updatedAt"`,
      [userEmail, bookId, rating, comment]
    );

    return NextResponse.json({ ok: true, data: savedReview.rows[0] }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "レビューの保存に失敗しました" }, { status: 500 });
  }
}
