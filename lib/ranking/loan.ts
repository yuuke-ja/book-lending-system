import "server-only";

import { db } from "@/lib/db";

export type LoanRankingItem = {
  bookId: string;
  title: string;
  thumbnail?: string | null;
  loanCount: number;
  ranking: number;
};

export async function loanranking(): Promise<LoanRankingItem[]> {
  "use cache";

  const data = await db.query<LoanRankingItem>(
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
  );

  return data.rows;
}
