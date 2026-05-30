import { Admin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const MAX_IMPACT_SECONDS = 30 * 24 * 60 * 60;

function toNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseImpactSeconds(value: string) {
  const match = value.match(/^(\d+)(seconds|minutes|hours|days)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isInteger(amount) || amount <= 0) return null;

  const unit = match[2];
  const seconds =
    unit === "days"
      ? amount * 24 * 60 * 60
      : unit === "hours"
        ? amount * 60 * 60
        : unit === "minutes"
          ? amount * 60
          : amount;

  if (seconds > MAX_IMPACT_SECONDS) return null;
  return seconds;
}

export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const isAdmin = await Admin(email);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const postToLoanSeconds = parseImpactSeconds(
    searchParams.get("postToLoanImpactTime") ?? ""
  );
  const bookDetailToLoanSeconds = parseImpactSeconds(
    searchParams.get("bookDetailToLoanImpactTime") ?? ""
  );
  const threadLinkClickToLoanSeconds = parseImpactSeconds(
    searchParams.get("threadLinkClickToLoanImpactTime") ?? ""
  );
  const aiRecommendationDisplayToLoanSeconds = parseImpactSeconds(
    searchParams.get("aiRecommendationDisplayToLoanImpactTime") ?? ""
  );
  const aiRecommendationToLoanSeconds = parseImpactSeconds(
    searchParams.get("aiRecommendationToLoanImpactTime") ?? ""
  );

  if (
    postToLoanSeconds == null ||
    bookDetailToLoanSeconds == null ||
    threadLinkClickToLoanSeconds == null ||
    aiRecommendationDisplayToLoanSeconds == null ||
    aiRecommendationToLoanSeconds == null
  ) {
    return NextResponse.json(
      { error: "影響時間は 1seconds〜30days の形式で指定してください" },
      { status: 400 }
    );
  }

  try {
    const [
      summaryResult,
      pathResult,
      rankingResult,
      recentLogsResult,
      aiRecommendationResult,
      aiClickResult,
    ] = await Promise.all([
      db.query(
        `SELECT
           COUNT(*) FILTER (WHERE "eventType" = 'post_view') AS "postViewCount",
           COUNT(*) FILTER (WHERE "eventType" = 'book_detail_view') AS "bookDetailViewCount",
           COUNT(*) FILTER (WHERE "eventType" = 'loan') AS "loanCount",
           COUNT(DISTINCT "userEmail") AS "uniqueUserCount"
         FROM "ResearchEvent"`
      ),
      db.query(
        `WITH
           --投稿を見た後指定時間内に同じ本を借りたかず
           "postToLoan" AS (
             SELECT loan.id
             FROM "ResearchEvent" loan
             WHERE loan."eventType" = 'loan'
               AND EXISTS (
                 SELECT 1
                 FROM "ResearchEvent" post
                 WHERE post."eventType" = 'post_view'
                   AND post."userEmail" = loan."userEmail"
                   AND post."bookId" = loan."bookId"
                   AND post."occurredAt" <= loan."occurredAt"
                   AND post."occurredAt" >= loan."occurredAt" - ($1::int * interval '1 second')
                   AND NOT EXISTS (
                     SELECT 1
                     FROM "ResearchEvent" previous_loan
                     WHERE previous_loan."eventType" = 'loan'
                       AND previous_loan."userEmail" = loan."userEmail"
                       AND previous_loan."bookId" = loan."bookId"
                       AND previous_loan."occurredAt" > post."occurredAt"
                       AND previous_loan."occurredAt" < loan."occurredAt"
                   )
               )
           ),
           --投稿・コメント内の本リンクを押したかず
           "threadLinkClick" AS (
             SELECT link.id
             FROM "ResearchEvent" link
             WHERE link."eventType" = 'book_link_click'
               AND link."sourceType" IN ('thread', 'comment')
           ),
           --投稿・コメント内リンクをクリックした後、指定時間内に同じ本を借りたかず
           "threadLinkClickToLoan" AS (
             SELECT loan.id
             FROM "ResearchEvent" loan
             WHERE loan."eventType" = 'loan'
               AND EXISTS (
                 SELECT 1
                 FROM "ResearchEvent" link
                 WHERE link."eventType" = 'book_link_click'
                   AND link."sourceType" IN ('thread', 'comment')
                   AND link."userEmail" = loan."userEmail"
                   AND link."bookId" = loan."bookId"
                   AND link."occurredAt" <= loan."occurredAt"
                   AND link."occurredAt" >= loan."occurredAt" - ($3::int * interval '1 second')
                   AND NOT EXISTS (
                     SELECT 1
                     FROM "ResearchEvent" previous_loan
                     WHERE previous_loan."eventType" = 'loan'
                       AND previous_loan."userEmail" = loan."userEmail"
                       AND previous_loan."bookId" = loan."bookId"
                       AND previous_loan."occurredAt" > link."occurredAt"
                       AND previous_loan."occurredAt" < loan."occurredAt"
                   )
               )
           ),
           --投稿・コメント内リンククリックのまとまり数
           "threadClickGroup" AS (
             SELECT COUNT(*) AS count
             FROM (
               SELECT
                 link.id,
                 link."userEmail",
                 link."bookId",
                 link."occurredAt",
                 LAG(link."occurredAt") OVER (
                   PARTITION BY link."userEmail", link."bookId"
                   ORDER BY link."occurredAt", link.id
                 ) AS "previousClickAt"
               FROM "ResearchEvent" link
               WHERE link."eventType" = 'book_link_click'
                 AND link."sourceType" IN ('thread', 'comment')
                 AND link."bookId" IS NOT NULL
             ) link
             WHERE link."previousClickAt" IS NULL
                OR link."occurredAt" > link."previousClickAt" + ($3::int * interval '1 second')
                OR EXISTS (
                  SELECT 1
                  FROM "ResearchEvent" loan
                  WHERE loan."eventType" = 'loan'
                    AND loan."userEmail" = link."userEmail"
                    AND loan."bookId" = link."bookId"
                    AND loan."occurredAt" > link."previousClickAt"
                    AND loan."occurredAt" < link."occurredAt"
                )
           ),
           --本の詳細を見た後、指定時間内に同じ本を借りたかず
           "bookDetailToLoan" AS (
             SELECT
               loan.id,
               EXTRACT(EPOCH FROM (loan."occurredAt" - detail."occurredAt")) AS seconds
             FROM "ResearchEvent" loan
             JOIN LATERAL (
               SELECT detail."occurredAt"
               FROM "ResearchEvent" detail
                 WHERE detail."eventType" = 'book_detail_view'
                   AND detail."userEmail" = loan."userEmail"
                   AND detail."bookId" = loan."bookId"
                   AND detail."occurredAt" <= loan."occurredAt"
                 AND detail."occurredAt" >= loan."occurredAt" - ($2::int * interval '1 second')
                 AND NOT EXISTS (
                   SELECT 1
                   FROM "ResearchEvent" previous_loan
                   WHERE previous_loan."eventType" = 'loan'
                     AND previous_loan."userEmail" = loan."userEmail"
                     AND previous_loan."bookId" = loan."bookId"
                     AND previous_loan."occurredAt" > detail."occurredAt"
                     AND previous_loan."occurredAt" < loan."occurredAt"
                 )
               ORDER BY detail."occurredAt" DESC
               LIMIT 1
             ) detail ON true
             WHERE loan."eventType" = 'loan'
           ),
           -- AIおすすめリンクをクリックしたあと本を貸し出したか
           "aiRecommendationToLoan" AS(
             SELECT loan.id
              FROM "ResearchEvent" loan
              WHERE loan."eventType" = 'loan'
                AND EXISTS (
                  SELECT 1
                  FROM "ResearchEvent" ai_click
                  WHERE ai_click."eventType" = 'book_link_click'
                    AND ai_click."sourceType" = 'ai_chat'
                    AND ai_click."userEmail" = loan."userEmail"
                    AND ai_click."bookId" = loan."bookId"
                    AND ai_click."occurredAt" < loan."occurredAt"
                    AND ai_click."occurredAt" > loan."occurredAt" - ($5::int * interval '1 second')
                    AND NOT EXISTS (
                      SELECT 1
                      FROM "ResearchEvent" previous_loan
                      WHERE previous_loan."eventType" = 'loan'
                        AND previous_loan."userEmail" = loan."userEmail"
                        AND previous_loan."bookId" = loan."bookId"
                        AND previous_loan."occurredAt" > ai_click."occurredAt"
                        AND previous_loan."occurredAt" < loan."occurredAt"
                    )
                )
           ),
           --AIおすすめ表示後、指定時間内に同じ本を借りたかず
           "aiRecommendationDisplayToLoan" AS (
             SELECT loan.id
             FROM "ResearchEvent" loan
             WHERE loan."eventType" = 'loan'
               AND EXISTS (
                 SELECT 1
                 FROM "AiRecommendation" recommendation
                 WHERE recommendation."userEmail" = loan."userEmail"
                   AND recommendation."bookId" = loan."bookId"
                   AND recommendation."createdAt" <= loan."occurredAt"
                   AND recommendation."createdAt" >= loan."occurredAt" - ($4::int * interval '1 second')
                   AND NOT EXISTS (
                     SELECT 1
                     FROM "ResearchEvent" previous_loan
                     WHERE previous_loan."eventType" = 'loan'
                       AND previous_loan."userEmail" = loan."userEmail"
                       AND previous_loan."bookId" = loan."bookId"
                       AND previous_loan."occurredAt" > recommendation."createdAt"
                       AND previous_loan."occurredAt" < loan."occurredAt"
                   )
               )
           ),
           --AIおすすめ表示まとまり数
           "aiRecommendationGroup" AS (
             SELECT COUNT(*) AS count
             FROM (
               SELECT
                 ai_recommendation.id,
                 ai_recommendation."userEmail",
                 ai_recommendation."bookId",
                 ai_recommendation."createdAt",
                 LAG(ai_recommendation."createdAt") OVER (
                   PARTITION BY ai_recommendation."userEmail", ai_recommendation."bookId"
                   ORDER BY ai_recommendation."createdAt", ai_recommendation.id
                 ) AS "previousAIRecommendationAt"
               FROM "AiRecommendation" ai_recommendation
               WHERE ai_recommendation."bookId" IS NOT NULL
             ) ai_recommendation
             WHERE ai_recommendation."previousAIRecommendationAt" IS NULL
                OR ai_recommendation."createdAt" > ai_recommendation."previousAIRecommendationAt" + ($4::int * interval '1 second')
                OR EXISTS (
                  SELECT 1
                  FROM "ResearchEvent" loan
                  WHERE loan."eventType" = 'loan'
                    AND loan."userEmail" = ai_recommendation."userEmail"
                    AND loan."bookId" = ai_recommendation."bookId"
                    AND loan."occurredAt" > ai_recommendation."previousAIRecommendationAt"
                    AND loan."occurredAt" < ai_recommendation."createdAt"
                )
           ),
           --クリックされたAIおすすめリンクの数
           "aiLinkClick" AS (
             SELECT COUNT(DISTINCT click."sourceId") AS count
             FROM "ResearchEvent" click
             JOIN "AiRecommendation" recommendation
               ON recommendation.id = click."sourceId"
             WHERE click."eventType" = 'book_link_click'
               AND click."sourceType" = 'ai_chat'
               AND click."sourceId" IS NOT NULL
           ),
           --AIおすすめクリックのまとまり数
           "aiClickGroup" AS (
             SELECT COUNT(*) AS count
             FROM (
               SELECT
                 ai_click.id,
                 ai_click."userEmail",
                 ai_click."bookId",
                 ai_click."occurredAt",
                 LAG(ai_click."occurredAt") OVER (
                   PARTITION BY ai_click."userEmail", ai_click."bookId"
                   ORDER BY ai_click."occurredAt", ai_click.id
                 ) AS "previousClickAt"
               FROM "ResearchEvent" ai_click
               WHERE ai_click."eventType" = 'book_link_click'
                 AND ai_click."sourceType" = 'ai_chat'
                 AND ai_click."bookId" IS NOT NULL
             ) ai_click
             WHERE ai_click."previousClickAt" IS NULL
                OR ai_click."occurredAt" > ai_click."previousClickAt" + ($5::int * interval '1 second')
                OR EXISTS (
                  SELECT 1
                  FROM "ResearchEvent" loan
                  WHERE loan."eventType" = 'loan'
                    AND loan."userEmail" = ai_click."userEmail"
                    AND loan."bookId" = ai_click."bookId"
                    AND loan."occurredAt" > ai_click."previousClickAt"
                    AND loan."occurredAt" < ai_click."occurredAt"
                )
           )
         SELECT
           (SELECT COUNT(*) FROM "postToLoan") AS "postToLoanCount",
           (SELECT COUNT(*) FROM "threadLinkClick") AS "threadLinkClickCount",
           (SELECT COUNT(*) FROM "threadLinkClickToLoan") AS "threadLinkClickToLoanCount",
           (SELECT count FROM "threadClickGroup") AS "threadClickGroupCount",
           (SELECT COUNT(*) FROM "aiRecommendationToLoan") AS "aiRecommendationToLoanCount",
           (SELECT count FROM "aiRecommendationGroup") AS "aiRecommendationGroupCount",
           (SELECT count FROM "aiLinkClick") AS "clickedAiRecommendationCount",
           (SELECT count FROM "aiClickGroup") AS "aiClickGroupCount",
           (SELECT COUNT(*) FROM "aiRecommendationDisplayToLoan") AS "aiRecommendationDisplayToLoanCount",
           (SELECT COUNT(*) FROM "bookDetailToLoan") AS "bookDetailToLoanCount",
           (SELECT AVG(seconds) FROM "bookDetailToLoan") AS "avgBookDetailToLoanSeconds"`,
        [
          postToLoanSeconds,
          bookDetailToLoanSeconds,
          threadLinkClickToLoanSeconds,
          aiRecommendationDisplayToLoanSeconds,
          aiRecommendationToLoanSeconds,
        ]
      ),
      db.query(
        `SELECT
           event."bookId",
           book.title,
           COUNT(*) AS "viewCount"
         FROM "ResearchEvent" event
         LEFT JOIN "Book" book ON book.id = event."bookId"
         WHERE event."eventType" = 'book_detail_view'
         GROUP BY event."bookId", book.title
         ORDER BY COUNT(*) DESC, book.title ASC
         LIMIT 10`
      ),
      db.query(
        `SELECT
           event.id,
           to_char(event."occurredAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"+09:00"') AS "occurredAt",
           event."eventType",
           event."userEmail",
           event."bookId",
           event."sourceType",
           event."sourceId",
           book.title AS "bookTitle"
         FROM "ResearchEvent" event
         LEFT JOIN "Book" book ON book.id = event."bookId"
         ORDER BY event."occurredAt" DESC, event.id DESC
         LIMIT 20`
      ),
      db.query(
        `SELECT COUNT(*) AS count FROM "AiRecommendation"`
      ),
      db.query(
        `SELECT COUNT(*) AS count FROM "ResearchEvent" 
          WHERE "eventType" = 'book_link_click' AND "sourceType" = 'ai_chat'`
      )
    ]);

    const summary = summaryResult.rows[0] ?? {};
    const paths = pathResult.rows[0] ?? {};
    const aiRecommendation = aiRecommendationResult.rows[0] ?? {};
    const aiClick = aiClickResult.rows[0] ?? {};

    // AIがおすすめとして表示した本の数
    const aiRecommendationCount = toNumber(aiRecommendation.count);
    const aiRecommendationGroupCount = toNumber(paths.aiRecommendationGroupCount);

    // AIおすすめ内の本リンクをクリックした数
    const aiClickCount = toNumber(aiClick.count);
    const clickedAiRecommendationCount = toNumber(paths.clickedAiRecommendationCount);

    // AIおすすめ表示数のうち、どれだけクリックされたか
    const aiClickRate =
      aiRecommendationCount > 0 ? clickedAiRecommendationCount / aiRecommendationCount : 0;

    // 投稿・コメント内の本リンクをクリックした数
    const threadLinkClickCount = toNumber(paths.threadLinkClickCount);

    // 投稿・コメント内の本リンクをクリックしたあと貸出された数
    const threadLinkClickToLoanCount = toNumber(paths.threadLinkClickToLoanCount);
    const threadClickGroupCount = toNumber(paths.threadClickGroupCount);

    // AIおすすめ内の本リンクをクリックしたあと貸出された数
    const aiRecommendationToLoanCount = toNumber(paths.aiRecommendationToLoanCount);
    const aiClickGroupCount = toNumber(paths.aiClickGroupCount);

    // AIがおすすめとして表示したあと貸出された数
    const aiRecommendationDisplayToLoanCount = toNumber(
      paths.aiRecommendationDisplayToLoanCount
    );

    // 投稿・コメント内の本リンククリック数のうち、どれだけ貸出されたか
    const threadLinkClickToLoanRate =
      threadClickGroupCount > 0 ? threadLinkClickToLoanCount / threadClickGroupCount : 0;

    // AIおすすめクリック数のうち、どれだけ貸出されたか
    const aiRecommendationToLoanRate =
      aiClickGroupCount > 0 ? aiRecommendationToLoanCount / aiClickGroupCount : 0;

    // AIおすすめ表示数のうち、どれだけ貸出されたか
    const aiRecommendationDisplayToLoanRate =
      aiRecommendationGroupCount > 0
        ? aiRecommendationDisplayToLoanCount / aiRecommendationGroupCount
        : 0;

    return NextResponse.json(
      {
        summary: {
          postViewCount: toNumber(summary.postViewCount),
          bookDetailViewCount: toNumber(summary.bookDetailViewCount),
          loanCount: toNumber(summary.loanCount),
          uniqueUserCount: toNumber(summary.uniqueUserCount),
        },
        paths: {
          postToLoanCount: toNumber(paths.postToLoanCount),
          threadLinkClickCount,
          threadLinkClickToLoanCount,
          threadLinkClickToLoanRate,
          bookDetailToLoanCount: toNumber(paths.bookDetailToLoanCount),
          avgBookDetailToLoanSeconds: toNullableNumber(paths.avgBookDetailToLoanSeconds),
          aiRecommendationCount,
          aiRecommendationToLoanCount,
          aiRecommendationToLoanRate,
          aiRecommendationDisplayToLoanCount,
          aiRecommendationDisplayToLoanRate,
          aiClickCount,
          aiClickRate,
        },
        ranking: rankingResult.rows.map((row) => ({
          bookId: row.bookId,
          title: row.title,
          viewCount: toNumber(row.viewCount),
        })),
        recentLogs: recentLogsResult.rows,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("イベントダッシュボードの取得に失敗:", error);
    return NextResponse.json(
      { error: "イベントダッシュボードの取得に失敗しました" },
      { status: 500 }
    );
  }
}
