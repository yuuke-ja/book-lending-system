import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "認証されていません" }, { status: 401 });
    }

    const email = session.user?.email;
    const isAdmin = email ? await Admin(email) : false;
    if (!isAdmin) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { bookId } = await params;
    const data = await request.json();
    const title = typeof data.title === "string" ? data.title.trim() : "";
    const description =
      typeof data.description === "string" ? data.description : "";

    if (!bookId) {
      return NextResponse.json({ error: "bookIdがない" }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "タイトルがない" }, { status: 400 });
    }
    //変更
    const result = await db.query(
      `UPDATE "Book"
       SET title = $1,
           description = $2
       WHERE id = $3`,
      [title, description || null, bookId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "本が見つかりません" }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: true,
        message: "本の情報を更新しました",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("本情報更新エラー:", error);
    return NextResponse.json(
      { error: "本の情報更新に失敗しました" },
      { status: 500 }
    );
  }
}
