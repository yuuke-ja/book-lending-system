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

export async function PATCH(request: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const hasNickname = "nickname" in body;
    const hasAvatarUrl = "avatarUrl" in body;

    if (!hasNickname && !hasAvatarUrl) {
      return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
    }

    if (hasNickname && hasAvatarUrl) {
      await db.query(
        `UPDATE "User"
         SET nickname = $1,
             avatarurl = $2
         WHERE email = $3`,
        [body.nickname, body.avatarUrl, userEmail]
      );
    } else if (hasNickname) {
      await db.query(
        `UPDATE "User"
         SET nickname = $1
         WHERE email = $2`,
        [body.nickname, userEmail]
      );
    } else {
      await db.query(
        `UPDATE "User"
         SET avatarurl = $1
         WHERE email = $2`,
        [body.avatarUrl, userEmail]
      );
    }

    return NextResponse.json({ message: "プロフィールが更新されました" }, { status: 200 });
  } catch (error) {
    console.error("プロフィールの更新に失敗:", error);
    return NextResponse.json({ error: "プロフィールの更新に失敗しました" }, { status: 500 });
  }

}
