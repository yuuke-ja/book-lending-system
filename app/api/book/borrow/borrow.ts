import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ISBN13_REGEX = /^97[89]\d{10}$/;

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const isbn13 = searchParams.get("isbn13");
  if (!isbn13 || !ISBN13_REGEX.test(isbn13)) {
    return new Response("isbn13が不正です", { status: 400 });
  }

  try {
    const book = await prisma.book.findUnique({
      where: { isbn13 },
      select: {
        id: true,
        title: true,
        authors: true,
        isbn13: true,
        description: true,
        thumbnail: true,
      },
    });

    if (!book) {
      return new Response("この本は未登録です", { status: 404 });
    }

    return Response.json(book, { status: 200 });
  } catch {
    return new Response("本情報の取得に失敗しました", { status: 500 });
  }
}
