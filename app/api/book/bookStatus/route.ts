import { NextResponse } from 'next/server';
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

    const data = await db.query(
      `SELECT l."dueAt", b.title
       FROM "Loan" l
       INNER JOIN "Book" b ON b.id = l."bookId"
       WHERE l."userEmail" = $1
         AND l."returnedAt" IS NULL
         AND l."dueAt" IS NOT NULL
         AND l."dueAt" <= $2
       ORDER BY l."dueAt" ASC`,
      [email, todayEnd]
    );

    const dueToday: { bookTitle: string; dueDate: string }[] = [];
    const overdue: { bookTitle: string; dueDate: string }[] = [];
    for (const loan of data.rows) {
      if (!loan.dueAt) continue;
      if (loan.dueAt < todayStart) {
        overdue.push({
          bookTitle: loan.title,
          dueDate: loan.dueAt.toISOString(),
        });
      } else {
        dueToday.push({
          bookTitle: loan.title,
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
