import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ noticeId: string }> }
) {
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
    const { noticeId } = await params;
    const result = await db.query(
      `DELETE FROM "Notice"
       WHERE id = $1`,
      [noticeId]
    );



    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { error: "お知らせが見つかりません" },
        { status: 404 }
      );
    }



    return NextResponse.json({ message: "お知らせを削除しました" });
  } catch (error) {
    console.error("お知らせの削除に失敗:", error);
    return NextResponse.json(
      { error: "お知らせの削除に失敗しました" },
      { status: 500 }
    );
  }
}
