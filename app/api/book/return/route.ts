import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!session.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { bookId } = body;
    if (!bookId || typeof bookId !== "string") {
      return new Response("bookIdが不正です", { status: 400 });
    }
    const updated = await prisma.loan.updateMany({
      where: {
        bookId,
        userEmail: session.user.email,
        returnedAt: null,
      },
      data: {
        returnedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      return new Response("返却する貸出が見つかりません", { status: 404 });
    }


    return Response.json(
      { ok: true, mock: true, message: "返却が完了しました" },
      { status: 200 }
    );
  } catch (error) {
    return new Response("返却に失敗しました", { status: 500 });
  }
}
