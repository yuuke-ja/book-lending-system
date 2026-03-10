import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnlyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!DATE_ONLY_REGEX.test(value)) return null;
  return value;
}

export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email;

  const { searchParams } = new URL(request.url);
  const anchorDate = parseDateOnlyString(searchParams.get("anchorDate"));
  if (!anchorDate) {
    return NextResponse.json(
      { error: "anchorDate は YYYY-MM-DD 形式で指定してください" },
      { status: 400 }
    );
  }

  if (!email) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const result = await db.query(
      `SELECT
         -- 週の開始日（月曜 00:00）ごとの集計キー
         w."weekStart",
         -- その週に発生した貸出件数
         COUNT(l.*)::int AS "loanCount",
         -- その週に借りたユニーク利用者数
         COUNT(DISTINCT l."userEmail")::int AS "userCount"
       -- anchorDate を含む週を終点に、過去5週 + 今週の6週分を生成
       FROM generate_series(
         date_trunc('week', $1::date) - interval '5 weeks',
         date_trunc('week', $1::date),
         interval '1 week'
       ) AS w("weekStart")
       -- 週の範囲 [weekStart, weekStart + 1 week) で貸出を突き合わせる
       LEFT JOIN "Loan" l
         ON l."loanedAt" >= w."weekStart"
        AND l."loanedAt" < w."weekStart" + interval '1 week'
       GROUP BY w."weekStart"
       ORDER BY w."weekStart" ASC`,
      [anchorDate]
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("週次統計の取得に失敗:", error);
    return NextResponse.json(
      { error: "週次統計の取得に失敗しました" },
      { status: 500 }
    );
  }
}
