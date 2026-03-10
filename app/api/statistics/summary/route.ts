import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const [res, booksRes] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE "loanedAt" >= date_trunc('week', now())) AS "thisWeekLoanCount",
          COUNT(DISTINCT "userEmail") FILTER (WHERE "loanedAt" >= date_trunc('week', now())) AS "thisWeekUserCount",
          COUNT(*) FILTER (WHERE "loanedAt" >= date_trunc('month', now())) AS "thisMonthLoanCount",
          COUNT(DISTINCT "userEmail") FILTER (WHERE "loanedAt" >= date_trunc('month', now())) AS "thisMonthUserCount",
          COUNT(*) FILTER (WHERE "returnedAt" IS NULL) AS "activeLoanCount"
        FROM "Loan"
      `),
      db.query(`
        SELECT COUNT(*) AS "totalBookCount"
        FROM "Book"
      `),
    ]);

    const result = res.rows[0];
    const bookCount = booksRes.rows[0].totalBookCount;

    return NextResponse.json({
      thisWeekLoanCount: Number(result.thisWeekLoanCount),
      thisWeekUserCount: Number(result.thisWeekUserCount),
      thisMonthLoanCount: Number(result.thisMonthLoanCount),
      thisMonthUserCount: Number(result.thisMonthUserCount),
      activeLoanCount: Number(result.activeLoanCount),
      bookCount: Number(bookCount),
    });
  } catch (error) {
    console.error("サマリー取得に失敗:", error);
    return NextResponse.json(
      { error: "サマリーの取得に失敗しました" },
      { status: 500 }
    );
  }
}
