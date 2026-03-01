import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const ISBN13_REGEX = /^97[89]\d{10}$/;

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const isbn13 = searchParams.get("isbn13");
  if (!isbn13 || !ISBN13_REGEX.test(isbn13)) {
    return NextResponse.json({ error: "isbn13が不正です" }, { status: 400 });
  }

  try {
    const bookResult = await db.query(
      `SELECT id, title, authors, isbn13, description, thumbnail
       FROM "Book"
       WHERE isbn13 = $1
       LIMIT 1`,
      [isbn13]
    );
    const book = bookResult.rows[0];

    if (!book) {
      return NextResponse.json({ error: "この本は未登録です" }, { status: 404 });
    }

    return NextResponse.json(book, { status: 200 });
  } catch {
    return NextResponse.json({ error: "本情報の取得に失敗しました" }, { status: 500 });
  }
}
