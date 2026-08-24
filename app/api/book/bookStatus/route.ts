import { NextResponse } from 'next/server';
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function getJapaneseToday() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {} as Record<string, string>);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  const email = session.user?.email;
  if (!email) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  try {
    const today = getJapaneseToday();
    const todayStart = new Date(`${today}T00:00:00+09:00`);
    const todayEnd = new Date(`${today}T23:59:59.999+09:00`);

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
    console.error("返却期限ステータスの取得に失敗:", error);
    return NextResponse.json(
      { error: '返却期限ステータスの取得に失敗しました' },
      { status: 500 }
    );
  }
}
