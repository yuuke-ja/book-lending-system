import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const data = await db.query(
      `SELECT
        l."bookId",
        b.title,
        b.thumbnail,
        COUNT(*)::int AS "loanCount",
        RANK() OVER(ORDER BY COUNT(*) DESC) as ranking 
      FROM "Loan" l
      INNER JOIN "Book" b ON b.id = l."bookId"
      GROUP BY l."bookId", b.title, b.thumbnail
      ORDER BY ranking ASC, b.title ASC
      LIMIT 10;`
    )

    return NextResponse.json(data.rows, { status: 200 });
  } catch (error) {
    console.error("貸出ランキングの取得に失敗:", error);
    return NextResponse.json(
      { error: "貸出ランキングの取得に失敗しました" },
      { status: 500 }
    );
  }
}
