import "server-only";

import { db } from "@/lib/db";

type RefreshRecommendationRow = {
  lastGeneratedAt: Date | null;
  latestLogAt: Date;
};

export async function shouldRefreshRecommendations(
  userEmail: string
): Promise<boolean> {
  // 最後におすすめを生成した時刻と、最新の行動・検索ログ時刻を1回のSQLで比較する
  const result = await db.query<RefreshRecommendationRow>(
    `
    SELECT
    (
      SELECT MAX(recommendation."generatedAt")
      FROM "UserRecommendation" recommendation
      WHERE recommendation."userEmail" = $1
    ) AS "lastGeneratedAt",
    GREATEST(
      COALESCE((
        SELECT MAX(event."occurredAt")
        FROM "ResearchEvent" event
        WHERE event."userEmail" = $1
      ), '1970-01-01'::timestamp),
      COALESCE((
        SELECT MAX(search."occurredAt")
        FROM "SearchEvent" search
        WHERE search."userEmail" = $1
      ), '1970-01-01'::timestamp)
    ) AS "latestLogAt"
    `,
    [userEmail]
  )
  const row = result.rows[0]

  // まだおすすめが1件も作られていないユーザーは、初回アクセスで生成する
  if (!row.lastGeneratedAt) {
    return true
  }

  // おすすめ生成後に新しい行動・検索があれば、次のホーム表示で再生成する
  return row.latestLogAt > row.lastGeneratedAt;

}
