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
        u.id AS "userId",
        u.nickname,
        u.avatarurl AS "avatarUrl",
        COUNT(*)::int AS "loanCount",
        RANK() OVER(ORDER BY COUNT(*) DESC) as ranking
      FROM "Loan" l
      LEFT JOIN "User" u ON u.email = l."userEmail"
      GROUP BY l."userEmail", u.id, u.nickname, u.avatarurl
      ORDER BY ranking ASC, u.nickname ASC
      LIMIT 5;`
    );

    return NextResponse.json(data.rows, { status: 200 });
  } catch (error) {
    console.error("貸出ユーザーランキングの取得に失敗:", error);
    return NextResponse.json(
      { error: "貸出ユーザーランキングの取得に失敗しました" },
      { status: 500 }
    );
  }
}
