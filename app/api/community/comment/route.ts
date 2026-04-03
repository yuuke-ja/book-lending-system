import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (typeof body.threadId !== "string" || body.threadId.trim() === "") {
      return NextResponse.json({ error: "threadIdが不正です" }, { status: 400 });
    }
    const threadId = body.threadId.trim();

    if (
      body.parentCommentId != null &&
      (typeof body.parentCommentId !== "string" || body.parentCommentId.trim() === "")
    ) {
      return NextResponse.json({ error: "parentCommentIdが不正です" }, { status: 400 });
    }
    const parentCommentId = body.parentCommentId?.trim() ?? null;

    if (typeof body.content !== "string" || body.content.trim() === "") {
      return NextResponse.json({ error: "contentが不正です" }, { status: 400 });
    }
    const content = body.content.trim();

    if (
      body.bookIds != null &&
      (!Array.isArray(body.bookIds) ||
        body.bookIds.some((bookId: unknown) => typeof bookId !== "string" || bookId.trim() === ""))
    ) {
      return NextResponse.json({ error: "bookIdsが不正です" }, { status: 400 });
    }
    const bookIds = Array.isArray(body.bookIds)
      ? Array.from(new Set(body.bookIds.map((bookId: string) => bookId.trim())))
      : [];

    const threadResult = await db.query(
      `SELECT id
       FROM "Thread"
       WHERE id = $1
       LIMIT 1`,
      [threadId]
    );

    if ((threadResult.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "スレッドが見つかりません" }, { status: 404 });
    }

    if (parentCommentId) {
      const parentCommentResult = await db.query(
        `SELECT id, "threadId"
         FROM "ThreadComment"
         WHERE id = $1
         LIMIT 1`,
        [parentCommentId]
      );

      if ((parentCommentResult.rowCount ?? 0) === 0) {
        return NextResponse.json({ error: "親コメントが見つかりません" }, { status: 404 });
      }

      if (parentCommentResult.rows[0]?.threadId !== threadId) {
        return NextResponse.json({ error: "親コメントのthreadIdが一致しません" }, { status: 400 });
      }
    }

    if (bookIds.length > 0) {
      const booksResult = await db.query(
        `SELECT id
         FROM "Book"
         WHERE id = ANY($1::text[])`,
        [bookIds]
      );

      if ((booksResult.rowCount ?? 0) !== bookIds.length) {
        return NextResponse.json({ error: "存在しない本が含まれています" }, { status: 404 });
      }
    }

    await db.transaction(async (tx) => {
      const commentResult = await tx.query<{ id: string }>(
        `INSERT INTO "ThreadComment" ("threadId", "parentCommentId", "userEmail", content)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [threadId, parentCommentId, userEmail, content]
      );

      const commentId = commentResult.rows[0]?.id;
      if (!commentId) {
        throw new Error("comment insert failed");
      }

      if (bookIds.length > 0) {
        await tx.query(
          `INSERT INTO "CommentBookLink" ("commentId", "bookId")
           SELECT $1, unnest($2::text[])`,
          [commentId, bookIds]
        );
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("コメントの作成に失敗:", error);
    return NextResponse.json(
      { error: "コメントの作成に失敗しました" },
      { status: 500 }
    );
  }
}
