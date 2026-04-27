import "server-only";

import { db } from "@/lib/db";

export type UserLoanRankingItem = {
  userId?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  loanCount: number;
  ranking: number;
};

export async function userranking(): Promise<UserLoanRankingItem[]> {
  "use cache";

  const data = await db.query<UserLoanRankingItem>(
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

  return data.rows;
}
