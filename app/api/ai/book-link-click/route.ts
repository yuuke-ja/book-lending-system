import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordResearchEvent } from "@/lib/research-event.server";

export async function POST(request: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.eventType !== "book_link_click") {
      return NextResponse.json({ error: "eventTypeが不正です" }, { status: 400 });
    }

    if (typeof body.bookId !== "string" || body.bookId.trim() === "") {
      return NextResponse.json({ error: "bookIdが不正です" }, { status: 400 });
    }
    const bookId = body.bookId.trim();

    if (body.sourceType !== "ai_chat") {
      return NextResponse.json({ error: "sourceTypeが不正です" }, { status: 400 });
    }

    if (typeof body.sourceId !== "string" || body.sourceId.trim() === "") {
      return NextResponse.json({ error: "sourceIdが不正です" }, { status: 400 });
    }
    const sourceId = body.sourceId.trim();

    await recordResearchEvent({
      eventType: "book_link_click",
      userEmail,
      bookId,
      sourceType: "ai_chat",
      sourceId,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("AIおすすめから本ログの保存に失敗:", error);
    return NextResponse.json(
      { error: "AIおすすめから本ログの保存に失敗しました" },
      { status: 500 }
    );
  }
}
