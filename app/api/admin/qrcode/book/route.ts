import axios from "axios";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { NextResponse } from "next/server";

type RakutenMagazineSearchResponse = {
  Items?: Array<{
    title?: string;
    publisherName?: string;
    itemCaption?: string;
    largeImageUrl?: string;
    mediumImageUrl?: string;
    smallImageUrl?: string;
  }>;
  items?: Array<{
    title?: string;
    publisherName?: string;
    itemCaption?: string;
    largeImageUrl?: string;
    mediumImageUrl?: string;
    smallImageUrl?: string;
  }>;
};

export async function GET(request: Request) {
  let isbn = "";
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
    isbn = searchParams.get("isbn") ?? "";

    if (!isbn || !/^\d{13}$/.test(isbn)) {
      return NextResponse.json({ error: "ISBNが不正です" }, { status: 400 });
    }

    if (isbn.startsWith("491")) {
      if (!process.env.RAKUTEN_APP_ID || !process.env.RAKUTEN_ACCESS_KEY) {
        return NextResponse.json({ error: "楽天APIの設定が不足しています" }, { status: 500 });
      }
      const requestOrigin = new URL(request.url).origin;

      const res = await axios.get<RakutenMagazineSearchResponse>(
        "https://openapi.rakuten.co.jp/services/api/BooksMagazine/Search/20170404",
        {
          headers: {
            Origin: requestOrigin,
          },
          params: {
            applicationId: process.env.RAKUTEN_APP_ID,
            accessKey: process.env.RAKUTEN_ACCESS_KEY,
            jan: isbn,
            format: "json",
            formatVersion: 2,
            hits: 1,
            outOfStockFlag: 1,
          },
        }
      );

      const item = res.data.Items?.[0] ?? res.data.items?.[0];
      if (!item) {
        return NextResponse.json({ error: "雑誌が見つかりません" }, { status: 404 });
      }

      return NextResponse.json({
        googleBookId: null,
        isbn13: isbn,
        title: item.title ?? "",
        authors: item.publisherName ? [item.publisherName] : [],
        description: item.itemCaption ?? null,
        thumbnail: item.largeImageUrl ?? item.mediumImageUrl ?? item.smallImageUrl ?? null,
      });
    } else {
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
    }
  } catch (error) {
    if (isbn.startsWith("491") && axios.isAxiosError(error) && error.response?.status === 404) {
      return NextResponse.json({ error: "雑誌が見つかりません" }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "サーバー側でエラーが発生しました" }, {
      status: 500,
    });
  }
}
