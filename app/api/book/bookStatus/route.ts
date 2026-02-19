import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const email = session.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const data = await prisma.loan.findMany({
      where: {
        userEmail: email,
        returnedAt: null,
        dueAt: {
          lte: todayEnd,
        },
      },
      include: {
        book: true,
      },
      orderBy: {
        dueAt: 'asc',
      },
    });

    const dueToday: { bookTitle: string; dueDate: string }[] = [];
    const overdue: { bookTitle: string; dueDate: string }[] = [];
    for (const loan of data) {
      if (!loan.dueAt) continue;
      if (loan.dueAt < todayStart) {
        overdue.push({
          bookTitle: loan.book.title,
          dueDate: loan.dueAt.toISOString(),
        });
      } else {
        dueToday.push({
          bookTitle: loan.book.title,
          dueDate: loan.dueAt.toISOString(),
        });
      }
    }

    const books = { dueToday, overdue };

    return NextResponse.json(books);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch book status' },
      { status: 500 }
    );
  }
}
