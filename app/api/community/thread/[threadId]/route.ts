import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getThreadDetail } from "@/lib/community/get-thread-detail";
import { recordResearchEvent } from "@/lib/research-event.server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { threadId } = await params;

  try {
    const detail = await getThreadDetail(threadId);

    if (!detail) {
      return NextResponse.json({ error: "スレッドが見つかりません" }, { status: 404 });
    }

    if (detail.thread.bookId) {
      await recordResearchEvent({
        eventType: "post_view",
        userEmail,
        bookId: detail.thread.bookId,
        sourceType: "thread",
        sourceId: threadId,
      });
    }

    return NextResponse.json(detail, { status: 200 });
  } catch (error) {
    console.error("スレッド詳細の取得に失敗:", error);
    return NextResponse.json(
      { error: "スレッドの取得に失敗しました" },
      { status: 500 }
    );
  }
}
