import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordResearchEvent } from "@/lib/research-event.server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { threadId } = await params;

  try {
    const threadResult = await db.query<{
      id: string;
      content: string;
      bookId: string | null;
      kind: string;
      createdAt: string;
      nickname: string | null;
      authorAvatarUrl: string | null;
    }>(
      `SELECT
         t.id,
         t.content,
         t."bookId" AS "bookId",
         t.kind,
         t."createdAt" AS "createdAt",
         u.nickname AS nickname,
         u.avatarurl AS "authorAvatarUrl"
       FROM "Thread" t
       LEFT JOIN "User" u ON u.email = t."userEmail"
       WHERE t.id = $1
       LIMIT 1`,
      [threadId]
    );

    if ((threadResult.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "スレッドが見つかりません" }, { status: 404 });
    }

    const thread = threadResult.rows[0];

    if (thread.bookId) {
      await recordResearchEvent({
        eventType: "post_view",
        userEmail,
        bookId: thread.bookId,
        sourceType: "thread",
        sourceId: threadId,
      });
    }

    const linkedThreadBookResult = thread.bookId
      ? await db.query<{
          id: string;
          title: string;
          thumbnail: string | null;
        }>(
          `SELECT id, title, thumbnail
           FROM "Book"
           WHERE id = $1
           LIMIT 1`,
          [thread.bookId]
        )
      : null;

    const commentResult = await db.query<{
      id: string;
      threadId: string;
      parentCommentId: string | null;
      content: string;
      createdAt: string;
      nickname: string | null;
      authorAvatarUrl: string | null;
    }>(
      `SELECT
         c.id,
         c."threadId" AS "threadId",
         c."parentCommentId" AS "parentCommentId",
         c.content,
         c."createdAt" AS "createdAt",
         u.nickname AS nickname,
         u.avatarurl AS "authorAvatarUrl"
       FROM "ThreadComment" c
       LEFT JOIN "User" u ON u.email = c."userEmail"
       WHERE c."threadId" = $1
       ORDER BY c."createdAt" ASC`,
      [threadId]
    );

    const commentIds = commentResult.rows.map((comment) => comment.id);
    const commentBookResult =
      commentIds.length > 0
        ? await db.query<{
            commentId: string;
            id: string;
            title: string;
            thumbnail: string | null;
          }>(
            `SELECT
               cbl."commentId" AS "commentId",
               b.id,
               b.title,
               b.thumbnail
             FROM "CommentBookLink" cbl
             INNER JOIN "Book" b ON b.id = cbl."bookId"
             WHERE cbl."commentId" = ANY($1::text[])
             ORDER BY cbl."createdAt" ASC`,
            [commentIds]
          )
        : { rows: [] };

    const linkedBooksByCommentId = commentBookResult.rows.reduce<
      Record<string, { id: string; title: string; thumbnail: string | null }[]>
    >((acc, row) => {
      if (!acc[row.commentId]) {
        acc[row.commentId] = [];
      }

      acc[row.commentId].push({
        id: row.id,
        title: row.title,
        thumbnail: row.thumbnail,
      });

      return acc;
    }, {});

    return NextResponse.json(
      {
        thread: {
          ...thread,
          linkedBook: linkedThreadBookResult?.rows[0] ?? null,
        },
        comments: commentResult.rows.map((comment) => ({
          ...comment,
          linkedBooks: linkedBooksByCommentId[comment.id] ?? [],
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("スレッド詳細の取得に失敗:", error);
    return NextResponse.json(
      { error: "スレッドの取得に失敗しました" },
      { status: 500 }
    );
  }
}
