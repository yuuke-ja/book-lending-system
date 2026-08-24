import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tagIds = Array.from(
    new Set(
      searchParams
        .getAll("tagIds")
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  if (tagIds.length === 0) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const searchtag = await db.query(
      `WITH review_summary AS (
         SELECT
           "bookId",
           AVG(rating)::float AS "averageRating"
         FROM "BookReview"
         GROUP BY "bookId"
       ),
       tag_summary AS (
         SELECT
           bt."bookId",
           jsonb_agg(
             jsonb_build_object('id', tl.id, 'tag', tl.tag)
             ORDER BY tl.tag
           ) AS "tags"
         FROM "BookTag" bt
         INNER JOIN "TagList" tl ON tl.id = bt."tagId"
         GROUP BY bt."bookId"
       )
       SELECT
         b.id,
         b."googleBookId",
         b.isbn13,
         b.title,
         b.authors,
         b.description,
         b.thumbnail,
         b."createdAt",
         COALESCE(rs."averageRating", 0)::float AS "averageRating",
         COALESCE(ts."tags", '[]'::jsonb) AS "tags"
       FROM "Book" b
       LEFT JOIN review_summary rs ON rs."bookId" = b.id
       LEFT JOIN tag_summary ts ON ts."bookId" = b.id
       WHERE EXISTS (
         SELECT 1
         FROM "BookTag" bt
         WHERE bt."bookId" = b.id
           AND bt."tagId" = ANY($1::text[])
       )
       ORDER BY b."createdAt" DESC
       LIMIT 20`,
      [tagIds]
    );

    return NextResponse.json(searchtag.rows, { status: 200 });
  } catch (error) {
    console.error("ジャンル検索に失敗:", error);
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }
}
