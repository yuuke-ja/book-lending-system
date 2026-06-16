import { Admin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const DEFAULT_WEIGHTS = {
  searchBookList: 1,
  searchAiQuery: 1,
  loan: 10,
  bookDetailView: 0.5,
  postView: 0.5,
  threadBookLinkClick: 2,
  commentBookLinkClick: 2,
  aiBookLinkClick: 2,
  aiRecommendationView: 0.5,
  threadCreate: 3,
  commentCreate: 1,
};

type GenrePointRow = {
  month: Date;
  tagId: string;
  tagName: string;
  points: number;
};

function parseWeight(value: string, defaultValue: number) {
  if (value === "") return defaultValue;

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return numberValue;
}

export async function GET(request: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const isAdmin = await Admin(userEmail);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const searchBookListPoint = parseWeight(
    searchParams.get("searchBookList") ?? "",
    DEFAULT_WEIGHTS.searchBookList
  );
  const searchAiQueryPoint = parseWeight(
    searchParams.get("searchAiQuery") ?? "",
    DEFAULT_WEIGHTS.searchAiQuery
  );
  const loanPoint = parseWeight(
    searchParams.get("loan") ?? "",
    DEFAULT_WEIGHTS.loan
  );
  const bookDetailViewPoint = parseWeight(
    searchParams.get("bookDetailView") ?? "",
    DEFAULT_WEIGHTS.bookDetailView
  );
  const postViewPoint = parseWeight(
    searchParams.get("postView") ?? "",
    DEFAULT_WEIGHTS.postView
  );
  const threadBookLinkClickPoint = parseWeight(
    searchParams.get("threadBookLinkClick") ?? "",
    DEFAULT_WEIGHTS.threadBookLinkClick
  );
  const commentBookLinkClickPoint = parseWeight(
    searchParams.get("commentBookLinkClick") ?? "",
    DEFAULT_WEIGHTS.commentBookLinkClick
  );
  const aiBookLinkClickPoint = parseWeight(
    searchParams.get("aiBookLinkClick") ?? "",
    DEFAULT_WEIGHTS.aiBookLinkClick
  );
  const aiRecommendationViewPoint = parseWeight(
    searchParams.get("aiRecommendationView") ?? "",
    DEFAULT_WEIGHTS.aiRecommendationView
  );
  const threadCreatePoint = parseWeight(
    searchParams.get("threadCreate") ?? "",
    DEFAULT_WEIGHTS.threadCreate
  );
  const commentCreatePoint = parseWeight(
    searchParams.get("commentCreate") ?? "",
    DEFAULT_WEIGHTS.commentCreate
  );

  if (
    searchBookListPoint == null ||
    searchAiQueryPoint == null ||
    loanPoint == null ||
    bookDetailViewPoint == null ||
    postViewPoint == null ||
    threadBookLinkClickPoint == null ||
    commentBookLinkClickPoint == null ||
    aiBookLinkClickPoint == null ||
    aiRecommendationViewPoint == null ||
    threadCreatePoint == null ||
    commentCreatePoint == null
  ) {
    return NextResponse.json(
      { error: "ポイントは0以上の数値で指定してください" },
      { status: 400 }
    );
  }

  const result = await db.query<GenrePointRow>(
    `WITH point_events AS (
       SELECT
         se."occurredAt",
         event_tag."tagId",
         CASE se."searchType"
           WHEN 'book_list' THEN event_tag.confidence * $1::float
           WHEN 'ai_query' THEN event_tag.confidence * $2::float
           ELSE 0
         END AS points
       FROM "SearchEvent" se
       JOIN "SearchEventTag" event_tag
         ON event_tag."searchEventId" = se.id

       UNION ALL

       SELECT
         loan."loanedAt" AS "occurredAt",
         book_tag."tagId",
         $3::float AS points
       FROM "Loan" loan
       JOIN "BookTag" book_tag
         ON book_tag."bookId" = loan."bookId"

       UNION ALL

       SELECT
         event."occurredAt",
         book_tag."tagId",
         $4::float AS points
       FROM "ResearchEvent" event
       JOIN "BookTag" book_tag
         ON book_tag."bookId" = event."bookId"
       WHERE event."eventType" = 'book_detail_view'

       UNION ALL

       SELECT
         event."occurredAt",
         book_tag."tagId",
         $5::float AS points
       FROM "ResearchEvent" event
       JOIN "BookTag" book_tag
         ON book_tag."bookId" = event."bookId"
       WHERE event."eventType" = 'post_view'

       UNION ALL

       SELECT
         event."occurredAt",
         book_tag."tagId",
         $6::float AS points
       FROM "ResearchEvent" event
       JOIN "BookTag" book_tag
         ON book_tag."bookId" = event."bookId"
       WHERE event."eventType" = 'book_link_click'
         AND event."sourceType" = 'thread'

       UNION ALL

       SELECT
         event."occurredAt",
         book_tag."tagId",
         $7::float AS points
       FROM "ResearchEvent" event
       JOIN "BookTag" book_tag
         ON book_tag."bookId" = event."bookId"
       WHERE event."eventType" = 'book_link_click'
         AND event."sourceType" = 'comment'

       UNION ALL

       SELECT
         event."occurredAt",
         book_tag."tagId",
         $8::float AS points
       FROM "ResearchEvent" event
       JOIN "BookTag" book_tag
         ON book_tag."bookId" = event."bookId"
       WHERE event."eventType" = 'book_link_click'
         AND event."sourceType" = 'ai_chat'

       UNION ALL

       SELECT
         recommendation."createdAt" AS "occurredAt",
         book_tag."tagId",
         $9::float AS points
       FROM "AiRecommendation" recommendation
       JOIN "BookTag" book_tag
         ON book_tag."bookId" = recommendation."bookId"

       UNION ALL

       SELECT
         thread."createdAt" AS "occurredAt",
         book_tag."tagId",
         $10::float AS points
       FROM "Thread" thread
       JOIN "BookTag" book_tag
         ON book_tag."bookId" = thread."bookId"
       WHERE thread."bookId" IS NOT NULL

       UNION ALL

       SELECT
         comment."createdAt" AS "occurredAt",
         book_tag."tagId",
         $11::float AS points
       FROM "ThreadComment" comment
       JOIN "CommentBookLink" comment_book_link
         ON comment_book_link."commentId" = comment.id
       JOIN "BookTag" book_tag
         ON book_tag."bookId" = comment_book_link."bookId"
     )
         
     SELECT
       date_trunc('month', point_events."occurredAt") AS month,
       tag.id AS "tagId",
       tag.tag AS "tagName",
       SUM(point_events.points)::float AS points
     FROM point_events
     JOIN "TagList" tag
       ON tag.id = point_events."tagId"
     GROUP BY
       date_trunc('month', point_events."occurredAt"),
       tag.id,
       tag.tag
     ORDER BY
       month ASC,
       points DESC`,
    [
      searchBookListPoint,
      searchAiQueryPoint,
      loanPoint,
      bookDetailViewPoint,
      postViewPoint,
      threadBookLinkClickPoint,
      commentBookLinkClickPoint,
      aiBookLinkClickPoint,
      aiRecommendationViewPoint,
      threadCreatePoint,
      commentCreatePoint,
    ]
  );

  return NextResponse.json(
    {
      weights: {
        searchBookList: searchBookListPoint,
        searchAiQuery: searchAiQueryPoint,
        loan: loanPoint,
        bookDetailView: bookDetailViewPoint,
        postView: postViewPoint,
        threadBookLinkClick: threadBookLinkClickPoint,
        commentBookLinkClick: commentBookLinkClickPoint,
        aiBookLinkClick: aiBookLinkClickPoint,
        aiRecommendationView: aiRecommendationViewPoint,
        threadCreate: threadCreatePoint,
        commentCreate: commentCreatePoint,
      },
      rows: result.rows,
    },
    { status: 200 }
  );
}
