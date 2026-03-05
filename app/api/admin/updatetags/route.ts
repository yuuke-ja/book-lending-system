import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function PUT(request: NextRequest) {
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

    const data = await request.json();
    if (!data.bookId || typeof data.bookId !== "string" || data.tags === undefined || !Array.isArray(data.tags)) {
      return NextResponse.json({ error: "bookIdまたはtagsが不正です" }, { status: 400 });
    }
    const tags = Array.isArray(data.tags)
      ? data.tags
      : Array.isArray(data.add)
        ? data.add
        : [];


    await db.transaction(async (tx) => {
      await tx.query(
        `DELETE FROM "BookTag" WHERE "bookId" = $1`,
        [data.bookId]
      );
      if (tags.length > 0) {
        await tx.query(
          `INSERT INTO "BookTag" ("bookId", "tagId")
           SELECT $1, id FROM "TagList" WHERE id = ANY($2::text[])`,
          [data.bookId, tags]
        );
      }
    });

    return NextResponse.json(
      { ok: true, mock: true, message: "タグの更新が完了しました" },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "タグの更新に失敗しました" }, { status: 500 });
  }
}
