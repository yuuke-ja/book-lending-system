import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const email = session.user?.email;
  const isAdmin = email ? await Admin(email) : false;
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const pending = await prisma.pendingBook.findMany();

    await prisma.$transaction(async (tx: any) => {
      for (const pb of pending) {
        //PendingBookをBookに登録または更新
        await tx.book.upsert({
          where: { isbn13: pb.isbn13 },
          create: {
            googleBookId: pb.googleBookId,
            isbn13: pb.isbn13,
            title: pb.title,
            authors: pb.authors,
            description: pb.description,
            thumbnail: pb.thumbnail,
          },
          update: {
            googleBookId: pb.googleBookId,
            title: pb.title,
            authors: pb.authors,
            description: pb.description,
            thumbnail: pb.thumbnail,
          },
        });
      }
      await tx.pendingBook.deleteMany();
    });

    return NextResponse.json(
      { message: "All pending books registered successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to register books" },
      { status: 500 }
    );
  }
}
