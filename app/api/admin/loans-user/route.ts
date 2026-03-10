import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const email = session.user?.email;
    const isAdmin = email ? await Admin(email) : false;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const loans = await db.query(
      `SELECT
         l.id,
         l."userEmail",
         l."bookId",
         l."loanedAt",
         l."dueAt",
         b.id AS "book_id",
         b."googleBookId" AS "book_googleBookId",
         b.isbn13 AS "book_isbn13",
         b.title AS "book_title",
         b.authors AS "book_authors",
         b.description AS "book_description",
         b.thumbnail AS "book_thumbnail",
         b."createdAt" AS "book_createdAt",
         COUNT(*) OVER(PARTITION BY l."userEmail") AS "userTotalLoanCount",
         MAX(l."loanedAt") OVER(PARTITION BY l."userEmail") AS "userLatestLoanedAt"
       FROM "Loan" l
       INNER JOIN "Book" b ON b.id = l."bookId"
       WHERE l."returnedAt" IS NULL
       ORDER BY l."userEmail" ASC, l."loanedAt" DESC`
    );
    return NextResponse.json(loans.rows, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "貸出一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
