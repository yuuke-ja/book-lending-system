import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";
  if (!query) {
    return NextResponse.json([], { status: 200 });
  }

  const searchKeywords = Array.from(
    new Set(
      query
        .split(/[,\s、，]+/)
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    )
  ).slice(0, 5);
  if (searchKeywords.length === 0) {
    return NextResponse.json([], { status: 200 });
  }

  // タイトル、著者、説明文に対して全文検索を行う。
  try {
    const search = await db.query(
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
         COALESCE(ts."tags", '[]'::jsonb) AS "tags",
         pgroonga_score(b.tableoid, b.ctid) AS score
       FROM "Book" b
       LEFT JOIN review_summary rs ON rs."bookId" = b.id
       LEFT JOIN tag_summary ts ON ts."bookId" = b.id
       WHERE b.title &@| $1::text[]
          OR b.authors &@| $1::text[]
          OR b.description &@| $1::text[]
       ORDER BY score DESC, b."createdAt" DESC
       LIMIT 20`,
      [searchKeywords]
    );
    return NextResponse.json(search.rows, { status: 200 });
  } catch (error) {
    console.error("全文検索に失敗:", error);
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }

}
