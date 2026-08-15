import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getThreadList } from "@/lib/community/get-thread-list";

export async function GET(request: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get("bookId");
    const threadList = await getThreadList(bookId);

    return NextResponse.json(threadList, { status: 200 });
  } catch (error) {
    console.error("スレッドの取得に失敗:", error);
    return NextResponse.json(
      { error: "スレッドの取得に失敗しました" },
      { status: 500 }
    );
  }
}
