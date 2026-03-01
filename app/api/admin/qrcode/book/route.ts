import axios from "axios";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isAdmin = await Admin(email);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = new URL(request.url).searchParams;
    const isbn = searchParams.get("isbn");

    if (!isbn || !/^\d{13}$/.test(isbn)) {
      return NextResponse.json({ error: "ISBNが不正です" }, { status: 400 });
    }


    const res = await axios.get(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${process.env.BOOKS_API_KEY}`
    );

    const item = res.data.items?.[0];
    if (!item) {
      return NextResponse.json({ error: "本が見つかりません" }, { status: 404 });
    }

    return NextResponse.json({
      googleBookId: item.id,
      isbn13: isbn,
      title: item.volumeInfo.title,
      authors: item.volumeInfo.authors ?? [],
      description: item.volumeInfo.description ?? null,
      thumbnail: item.volumeInfo.imageLinks?.thumbnail ?? null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "サーバー側でエラーが発生しました" }, {
      status: 500,
    });
  }
}
