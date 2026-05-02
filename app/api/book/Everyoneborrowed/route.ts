import { auth } from "@/lib/auth";
import { getLoanedBookIds } from "@/lib/books/get-loaned-book-ids";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  const userEmail = session.user?.email;
  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const bookIds = await getLoanedBookIds();
    return NextResponse.json(
      bookIds.map((bookId) => ({
        bookId,
      })),
      { status: 200 }
    );
  } catch (error) {
    console.error("貸出中の本一覧の取得に失敗:", error);
    return NextResponse.json({ error: "貸出状況の取得に失敗しました" }, {
      status: 500,
    });
  }
}
