import axios from "axios";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const isbn = searchParams.get("isbn");

    if (!isbn || !/^\d{13}$/.test(isbn)) return new Response("ISBNが不正です", { status: 400 });


    const res = await axios.get(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${process.env.BOOKS_API_KEY}`
    );

    const item = res.data.items?.[0];
    if (!item) {
      return new Response("本が見つかりません", { status: 404 });
    }

    return Response.json({
      googleBookId: item.id,
      isbn13: isbn,
      title: item.volumeInfo.title,
      authors: item.volumeInfo.authors ?? [],
      description: item.volumeInfo.description ?? null,
      thumbnail: item.volumeInfo.imageLinks?.thumbnail ?? null,
    });
  } catch (error) {
    console.error(error);
    return new Response("サーバー側でエラーが発生しました", {
      status: 500,
    });
  }
}
