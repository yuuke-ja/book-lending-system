import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { classifyBooks } from "@/lib/tags/classify-books";

export async function POST() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "ログインエラー" }, { status: 401 });
    }

    const email = session.user?.email;
    if (!email || !(await Admin(email))) {
      return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
    }

    const rows = await classifyBooks();

    return NextResponse.json({ count: rows.length, rows }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "全タグの自動付与に失敗しました" }, { status: 500 });
  }
}
