import "server-only";
import { db } from "@/lib/db";

export async function getLoanedBookIds(): Promise<string[]> {
  const result = await db.query<{ bookId: string }>(
    `SELECT
       l."bookId"
     FROM "Loan" l
     WHERE l."returnedAt" IS NULL
     ORDER BY l."loanedAt" DESC`
  );

  return result.rows.map((loan) => loan.bookId);
}
