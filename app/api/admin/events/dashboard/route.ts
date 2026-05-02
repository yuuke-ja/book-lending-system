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
  const postToBookDetailSeconds = parseImpactSeconds(
    searchParams.get("postToBookDetailImpactTime") ?? ""
  );
  const postToLoanSeconds = parseImpactSeconds(
    searchParams.get("postToLoanImpactTime") ?? ""
  );
  const threadLinkToBookDetailSeconds = parseImpactSeconds(
    searchParams.get("threadLinkToBookDetailImpactTime") ?? ""
  );
  const bookDetailToLoanSeconds = parseImpactSeconds(
    searchParams.get("bookDetailToLoanImpactTime") ?? ""
  );

  if (
    postToBookDetailSeconds == null ||
    postToLoanSeconds == null ||
    threadLinkToBookDetailSeconds == null ||
    bookDetailToLoanSeconds == null
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
           "postToBookDetail" AS (
             SELECT
               detail.id,
               EXTRACT(EPOCH FROM (detail."occurredAt" - post."occurredAt")) AS seconds
             FROM "ResearchEvent" detail
             JOIN LATERAL (
               SELECT post."occurredAt"
               FROM "ResearchEvent" post
               WHERE post."eventType" = 'post_view'
                 AND post."userEmail" = detail."userEmail"
                 AND post."bookId" = detail."bookId"
                 AND post."occurredAt" <= detail."occurredAt"
                 AND post."occurredAt" >= detail."occurredAt" - ($1::int * interval '1 second')
               ORDER BY post."occurredAt" DESC
               LIMIT 1
             ) post ON true
             WHERE detail."eventType" = 'book_detail_view'
           ),
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
                   AND post."occurredAt" >= loan."occurredAt" - ($2::int * interval '1 second')
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
           "threadLinkToBookDetail" AS (
             SELECT link.id
             FROM "ResearchEvent" link
             WHERE link."eventType" = 'book_link_click'
               AND link."sourceType" IN ('thread', 'comment')
               AND EXISTS (
                 SELECT 1
                 FROM "ResearchEvent" detail
                 WHERE detail."eventType" = 'book_detail_view'
                   AND detail."userEmail" = link."userEmail"
                   AND detail."bookId" = link."bookId"
                   AND detail."occurredAt" >= link."occurredAt"
                   AND detail."occurredAt" <= link."occurredAt" + ($3::int * interval '1 second')
               )
           ),
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
                 AND detail."occurredAt" >= loan."occurredAt" - ($4::int * interval '1 second')
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
           )
         SELECT
           (SELECT COUNT(*) FROM "postToBookDetail") AS "postToBookDetailCount",
           (SELECT COUNT(*) FROM "postToLoan") AS "postToLoanCount",
           (SELECT COUNT(*) FROM "threadLinkToBookDetail") AS "threadLinkToBookDetailCount",
           (SELECT COUNT(*) FROM "bookDetailToLoan") AS "bookDetailToLoanCount",
           (SELECT AVG(seconds) FROM "postToBookDetail") AS "avgPostToBookDetailSeconds",
           (SELECT AVG(seconds) FROM "bookDetailToLoan") AS "avgBookDetailToLoanSeconds"`,
        [
          postToBookDetailSeconds,
          postToLoanSeconds,
          threadLinkToBookDetailSeconds,
          bookDetailToLoanSeconds,
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
           event."occurredAt",
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
    ]);

    const summary = summaryResult.rows[0] ?? {};
    const paths = pathResult.rows[0] ?? {};

    return NextResponse.json(
      {
        summary: {
          postViewCount: toNumber(summary.postViewCount),
          bookDetailViewCount: toNumber(summary.bookDetailViewCount),
          loanCount: toNumber(summary.loanCount),
          uniqueUserCount: toNumber(summary.uniqueUserCount),
        },
        paths: {
          postToBookDetailCount: toNumber(paths.postToBookDetailCount),
          postToLoanCount: toNumber(paths.postToLoanCount),
          threadLinkToBookDetailCount: toNumber(paths.threadLinkToBookDetailCount),
          bookDetailToLoanCount: toNumber(paths.bookDetailToLoanCount),
          avgPostToBookDetailSeconds: toNullableNumber(paths.avgPostToBookDetailSeconds),
          avgBookDetailToLoanSeconds: toNullableNumber(paths.avgBookDetailToLoanSeconds),
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
