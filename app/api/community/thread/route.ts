import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getThreadList } from "@/lib/community/get-thread-list";

export async function POST(request: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.kind !== "BOOK_TOPIC" && body.kind !== "BOOK_REQUEST") {
      return NextResponse.json({ error: "kindが不正です" }, { status: 400 });
    }
    const kind = body.kind;

    if (body.bookId != null && typeof body.bookId !== "string") {
      return NextResponse.json({ error: "bookIdが不正です" }, { status: 400 });
    }
    const bookId = body.bookId ?? null;

    if (typeof body.content !== "string" || body.content.trim() === "") {
      return NextResponse.json({ error: "contentが不正です" }, { status: 400 });
    }
    const content = body.content.trim();

    if (kind === "BOOK_TOPIC" && !bookId) {
      return NextResponse.json({ error: "本に紐づく投稿にはbookIdが必要です" }, { status: 400 });
    }

    if (bookId) {
      const bookResult = await db.query(
        `SELECT 1
         FROM "Book"
         WHERE id = $1
         LIMIT 1`,
        [bookId]
      );

      if ((bookResult.rowCount ?? 0) === 0) {
        return NextResponse.json({ error: "本が見つかりません" }, { status: 404 });
      }
    }

    const threadResult = await db.query<{
      id: string;
      content: string;
      bookId: string | null;
      kind: string;
      createdAt: string;
    }>(
      `INSERT INTO "Thread" (kind, "bookId", "userEmail", content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, content, "bookId", kind, "createdAt"`,
      [kind, bookId, userEmail, content]
    );


    return NextResponse.json(threadResult.rows[0], { status: 200 });
  } catch (error) {
    console.error("スレッドの作成に失敗:", error);
    return NextResponse.json(
      { error: "スレッドの作成に失敗しました" },
      { status: 500 }
    );
  }
}



export async function GET(request: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get("bookId");
    const threadList = await getThreadList(bookId);

    return NextResponse.json(threadList, { status: 200 });
  } catch (error) {
    console.error("スレッドの取得に失敗:", error);
    return NextResponse.json(
      { error: "スレッドの取得に失敗しました" },
      { status: 500 }
    );
  }
}
