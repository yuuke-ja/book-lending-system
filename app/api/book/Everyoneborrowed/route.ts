import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userEmail = session.user?.email;
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const loans = await db.query(
      `SELECT
         l.id,
         l."bookId",
         l."loanedAt"
       FROM "Loan" l
       INNER JOIN "Book" b ON b.id = l."bookId"
       WHERE l."returnedAt" IS NULL
       ORDER BY l."loanedAt" DESC`
    );
    return NextResponse.json(
      loans.rows.map((loan) => ({
        id: loan.id,
        bookId: loan.bookId,
        loanedAt: loan.loanedAt,
      })),
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "貸出状況の取得に失敗しました" }, {
      status: 500,
    });
  }
}
