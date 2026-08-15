import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const result = await db.query(
      `SELECT email, nickname, avatarurl AS "avatarUrl"
       FROM "User"
       WHERE email = $1
       LIMIT 1`,
      [userEmail]
    );

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    const user = result.rows[0];
    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    console.error("プロフィールの取得に失敗:", error);
    return NextResponse.json({ error: "プロフィールの取得に失敗しました" }, { status: 500 });
  }
}
