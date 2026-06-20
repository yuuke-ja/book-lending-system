import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

type CreatedNoticeRow = {
  id: string;
  title: string;
  content: unknown;
  bookId: string | null;
  createdAt: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const isAdmin = await Admin(userEmail);
  if (!isAdmin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
    }

    const { title, content, bookId } = body as Record<string, unknown>;

    if (typeof title !== "string" || title.trim() === "") {
      return NextResponse.json({ error: "タイトルを入力してください" }, { status: 400 });
    }

    if (
      !content ||
      typeof content !== "object" ||
      (content as { type?: unknown }).type !== "doc"
    ) {
      return NextResponse.json({ error: "本文を入力してください" }, { status: 400 });
    }

    if (bookId != null && typeof bookId !== "string") {
      return NextResponse.json({ error: "bookIdが不正です" }, { status: 400 });
    }

    const normalizedBookId =
      typeof bookId === "string" && bookId.trim() !== "" ? bookId.trim() : null;




    if (normalizedBookId) {
      const bookResult = await db.query(
        `SELECT 1
         FROM "Book"
         WHERE id = $1
         LIMIT 1`,
        [normalizedBookId]
      );





      if ((bookResult.rowCount ?? 0) === 0) {
        return NextResponse.json({ error: "本が見つかりません" }, { status: 404 });
      }
    }





    const result = await db.query<CreatedNoticeRow>(
      `INSERT INTO "Notice" (title, content, "bookId")
       VALUES ($1, $2::jsonb, $3)
       RETURNING id, title, content, "bookId", "createdAt"`,
      [title.trim(), JSON.stringify(content), normalizedBookId]
    );





    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("お知らせの作成に失敗:", error);
    return NextResponse.json(
      { error: "お知らせの作成に失敗しました" },
      { status: 500 }
    );
  }
}
