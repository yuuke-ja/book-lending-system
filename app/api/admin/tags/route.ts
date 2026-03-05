import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user?.email;
    const isAdmin = email ? await Admin(email) : false;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await request.json();
    if (!Array.isArray(data.tags) || data.tags.length === 0) {
      return NextResponse.json({ error: "Invalid tags" }, { status: 400 });
    }

    const result = await db.query(
      `WITH input_tags AS (
         SELECT DISTINCT tag
         FROM unnest($1::text[]) AS t(tag)
         WHERE tag <> ''
       )
       INSERT INTO "TagList" (tag)
       SELECT tag
       FROM input_tags
       ON CONFLICT (tag)
       DO UPDATE SET tag = EXCLUDED.tag
       RETURNING *, (xmax = 0) AS inserted`,
      [data.tags]
    );
    const rows = result.rows;

    return NextResponse.json(rows, {
      status: rows.some((row) => row.inserted) ? 201 : 200,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "ログインエラー" }, { status: 401 });
    }
    const email = session.user?.email;
    const isAdmin = email ? await Admin(email) : false;
    if (!isAdmin) {
      return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
    }

    const result = await db.query(`SELECT id, tag FROM "TagList" ORDER BY tag ASC`);
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "タグ一覧の取得に失敗しました" }, { status: 500 });
  }
}
