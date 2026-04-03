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

  const tags = Array.from(
    new Set(
      query
        .split(/[,\s、，]+/)
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (tags.length === 0) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const searchtag = await db.query(
      `SELECT
         b.id, b."googleBookId", b.isbn13, b.title, b.authors, b.description, b.thumbnail, b."createdAt"
       FROM "Book" b
       WHERE EXISTS (
         SELECT 1
         FROM "BookTag" bt
         JOIN "TagList" t ON t.id = bt."tagId"
         WHERE bt."bookId" = b.id
           AND lower(t.tag) = ANY($1::text[])
       )
       ORDER BY b."createdAt" DESC
       LIMIT 20`,
      [tags]
    );

    return NextResponse.json(searchtag.rows, { status: 200 });
  } catch (error) {
    console.error("タグ検索に失敗:", error);
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }
}
