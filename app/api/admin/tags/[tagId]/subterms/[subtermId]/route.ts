import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tagId: string; subtermId: string }> }
) {
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

    const { tagId, subtermId } = await params;
    const result = await db.query(
      `DELETE FROM "TagSubterm"
       WHERE id = $1 AND "tagId" = $2`,
      [subtermId, tagId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "小要素が見つかりません" }, { status: 404 });
    }

    return NextResponse.json({ message: "小要素を削除しました" }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "小要素の削除に失敗しました" }, { status: 500 });
  }
}
