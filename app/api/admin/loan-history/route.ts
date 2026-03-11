import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

type LoanHistoryStatus = "all" | "borrowing" | "returned";

function confirmationStatus(value: string | null): LoanHistoryStatus | null {
  if (value === null || value === "") return "all";
  if (value === "all" || value === "borrowing" || value === "returned") {
    return value;
  }
  return null;
}

function conversionstatus(status: LoanHistoryStatus): string {
  if (status === "borrowing") {
    return 'WHERE l."returnedAt" IS NULL';
  }
  if (status === "returned") {
    return 'WHERE l."returnedAt" IS NOT NULL';
  }
  return "";
}

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const status = confirmationStatus(searchParams.get("status"));
    if (!status) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const whereClause = conversionstatus(status);
    const history = await db.query(
      `SELECT
         l.id AS "loanId",
         l."userEmail",
         l."bookId",
         l."loanedAt",
         l."returnedAt",
         l."dueAt",
         b.title AS "bookTitle",
         b.thumbnail AS "bookThumbnail",
         b.isbn13 AS "bookIsbn13",
         b.authors AS "bookAuthors",
         CASE
           WHEN l."returnedAt" IS NULL THEN 'borrowing'
           ELSE 'returned'
         END AS status
       FROM "Loan" l
       INNER JOIN "Book" b ON b.id = l."bookId"
       ${whereClause}
       ORDER BY l."loanedAt" DESC, l.id DESC`
    );

    return NextResponse.json(history.rows, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "貸出履歴の取得に失敗しました" },
      { status: 500 }
    );
  }
}
