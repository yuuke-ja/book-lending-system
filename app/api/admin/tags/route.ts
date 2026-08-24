import { connection, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET() {
  await connection();
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
    return NextResponse.json({ error: "ジャンル一覧の取得に失敗しました" }, { status: 500 });
  }
}
