import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      `SELECT id, "googleBookId", isbn13, title, authors, description, thumbnail, "createdAt",
      pgroonga_score(tableoid, ctid) AS score
     FROM "Book"
     WHERE title &@| $1::text[]
        OR authors &@| $1::text[]
        OR description &@| $1::text[]
     ORDER BY score DESC, "createdAt" DESC
     LIMIT 20`,
      [searchKeywords]
    );
    return NextResponse.json(search.rows, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }


}
