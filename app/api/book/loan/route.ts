import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordResearchEvent } from '@/lib/research-event.server';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

// 本番環境では日本時間どおりに曜日が取れないことがあるので、JSTで曜日を見る。
function getJstWeekday(date: Date): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    weekday: 'short',
  }).format(date);

  switch (weekday) {
    case 'Sun':
      return 0;
    case 'Mon':
      return 1;
    case 'Tue':
      return 2;
    case 'Wed':
      return 3;
    case 'Thu':
      return 4;
    case 'Fri':
      return 5;
    case 'Sat':
      return 6;
    default:
      return date.getUTCDay();
  }
}

function calcDueAtByReturnWeek(now: Date, returnWeek: number): Date {
  const safeWeekday =
    Number.isInteger(returnWeek) && returnWeek >= 1 && returnWeek <= 3
      ? returnWeek
      : 1;
  const due = new Date(now);
  const diff = (safeWeekday - getJstWeekday(now) + 7) % 7;
  due.setDate(due.getDate() + diff);

  // 日本時間の23:59:59にしたいので、UTCでは14:59:59を入れている。
  due.setUTCHours(14, 59, 59, 999);
  return due;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  const userEmail = session.user?.email;
  if (!userEmail) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { bookId } = body;
    if (!bookId || typeof bookId !== 'string') {
      return NextResponse.json({ error: 'bookIdが不正です' }, { status: 400 });
    }
    const now = new Date();
    //通常ルールをデータベースから読む
    const settingsResult = await db.query(
      `SELECT id, "fridayOnly", "loanPeriodDays"
       FROM "LoanSettings"
       ORDER BY "createdAt" ASC
       LIMIT 1`
    );
    const settings = settingsResult.rows[0] ?? null;
    let openPeriod = null;
    if (settings) {
      const openPeriodResult = await db.query(
        `SELECT id, "loanPeriodDays","endDate"
         FROM "LoanOpenPeriod"
         WHERE "loanSettingsId" = $1
           AND enabled = true
           AND "startDate" <= $2
           AND "endDate" >= $2
         LIMIT 1`,
        [settings.id, now]
      );
      openPeriod = openPeriodResult.rows[0] ?? null;
    }
    const fridayOnly = settings?.fridayOnly ?? true;
    const isFriday = getJstWeekday(now) === 5;
    const inOpenPeriod = !!openPeriod;
    if (fridayOnly && !isFriday && !inOpenPeriod) {
      return NextResponse.json({ error: '貸出は金曜日のみ可能です' }, { status: 403 });
    }
    const bookResult = await db.query(
      `SELECT id FROM "Book" WHERE id = $1 LIMIT 1`,
      [bookId]
    );
    const book = bookResult.rows[0];
    if (!book) {
      return NextResponse.json({ error: '本が見つかりません' }, { status: 404 });
    }
    const alreadyLoanedResult = await db.query(
      `SELECT id
       FROM "Loan"
       WHERE "bookId" = $1
         AND "returnedAt" IS NULL
       LIMIT 1`,
      [bookId]
    );
    const alreadyLoaned = alreadyLoanedResult.rows[0];
    if (alreadyLoaned) {
      return NextResponse.json({ error: 'すでに貸出中です' }, { status: 409 });
    }
    const returnWeek = settings?.loanPeriodDays ?? 2;
    const exceptionDays = openPeriod?.endDate ?? null;
    const dueAt = exceptionDays ?? calcDueAtByReturnWeek(now, returnWeek);
    const loanId = randomUUID();
    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO "Loan" (id, "userEmail", "bookId", "dueAt")
         VALUES ($1, $2, $3, $4)`,
        [
          loanId,
          userEmail,
          bookId,
          dueAt,
        ]
      );
      await recordResearchEvent(
        {
          eventType: 'loan',
          userEmail,
          bookId,
          sourceType: 'direct',
          sourceId: null,
        },
        tx
      );
    });
    return NextResponse.json({ message: '貸出が完了しました' }, { status: 200 });
  } catch (error) {
    console.error("貸出に失敗:", error);
    return NextResponse.json({ error: '貸出に失敗しました' }, {
      status: 500,
    });
  }
}
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  const userEmail = session.user?.email;
  if (!userEmail) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  try {
    const loans = await db.query(
      `SELECT
         l.id,
         l."bookId",
         l."loanedAt",
         l."dueAt",
         b.id AS "book_id",
         b."googleBookId" AS "book_googleBookId",
         b.isbn13 AS "book_isbn13",
         b.title AS "book_title",
         b.authors AS "book_authors",
         b.description AS "book_description",
         b.thumbnail AS "book_thumbnail",
         b."createdAt" AS "book_createdAt"
       FROM "Loan" l
       INNER JOIN "Book" b ON b.id = l."bookId"
       WHERE l."returnedAt" IS NULL
         AND l."userEmail" = $1
       ORDER BY l."loanedAt" DESC`,
      [userEmail]
    );
    return NextResponse.json(
      loans.rows.map((loan) => ({
        id: loan.id,
        bookId: loan.bookId,
        loanedAt: loan.loanedAt,
        dueAt: loan.dueAt,
        book: {
          id: loan.book_id,
          googleBookId: loan.book_googleBookId,
          isbn13: loan.book_isbn13,
          title: loan.book_title,
          authors: loan.book_authors,
          description: loan.book_description,
          thumbnail: loan.book_thumbnail,
          createdAt: loan.book_createdAt,
        },
      })),
      { status: 200 }
    );
  } catch (error) {
    console.error("貸出状況の取得に失敗:", error);
    return NextResponse.json({ error: '貸出状況の取得に失敗しました' }, {
      status: 500,
    });
  }
}
