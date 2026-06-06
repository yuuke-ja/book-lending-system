import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function DELETE(_request: Request,
  { params }: { params: Promise<{ tagId: string }> }) {

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "認証されていません" }, { status: 401 });
  }

  const email = session.user?.email;
  const isAdmin = email ? await Admin(email) : false;

  if (!isAdmin) {
    return NextResponse.json({ error: "管理者権限がありません" }, { status: 403 });
  }
  const { tagId } = await params;

  try {
    await db.query(
      `DELETE FROM "TagList" 
        WHERE id = $1`,
      [tagId]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "タグの削除に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ message: "タグを削除しました" }, { status: 200 });

}
