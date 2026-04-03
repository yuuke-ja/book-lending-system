import { NextResponse } from 'next/server';
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  try {
    const books = await db.query(

      `--レビューごとに集約して平均評価を作る。
      WITH review_summary AS (
         SELECT
           "bookId",
           AVG(rating)::float AS "averageRating"
         FROM "BookReview"
         GROUP BY "bookId"
       ),
       --タグを本ごとにまとめてJSON配列にする
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
         b.isbn13,
         b.title,
         b.authors,
         b.thumbnail,
         COALESCE(rs."averageRating", 0)::float AS "averageRating",
         COALESCE(ts."tags", '[]'::jsonb) AS "tags"
       FROM "Book" b
       LEFT JOIN review_summary rs ON rs."bookId" = b.id
       LEFT JOIN tag_summary ts ON ts."bookId" = b.id
       ORDER BY b."createdAt" DESC`

    );
    return NextResponse.json(books.rows, { status: 200 });
  } catch (error) {
    console.error("本一覧の取得に失敗:", error);
    return NextResponse.json(
      { error: '本一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}
