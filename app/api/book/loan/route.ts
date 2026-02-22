import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  const userEmail = session.user?.email;
  if (!userEmail) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const body = await request.json();
    const { bookId } = body;
    if (!bookId || typeof bookId !== 'string') {
      return new Response('bookIdが不正です', { status: 400 });
    }
    const now = new Date();
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
        `SELECT id, "loanPeriodDays"
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
    const isFriday = now.getDay() === 5;
    const inOpenPeriod = !!openPeriod;
    if (fridayOnly && !isFriday && !inOpenPeriod) {
      return new Response('貸出は金曜日のみ可能です', { status: 403 });
    }
    const bookResult = await db.query(
      `SELECT id FROM "Book" WHERE id = $1 LIMIT 1`,
      [bookId]
    );
    const book = bookResult.rows[0];
    if (!book) {
      return new Response('本が見つかりません', { status: 404 });
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
      return new Response('すでに貸出中です', { status: 409 });
    }
    const normalDays = settings?.loanPeriodDays ?? 2;
    const exceptionDays = openPeriod?.loanPeriodDays;
    const periodDays = exceptionDays ?? normalDays;
    await db.query(
      `INSERT INTO "Loan" (id, "userEmail", "bookId", "dueAt")
       VALUES ($1, $2, $3, $4)`,
      [
        randomUUID(),
        userEmail,
        bookId,
        new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000),
      ]
    );
    return new Response('貸出が完了しました', { status: 200 });
  } catch (error) {
    return new Response('貸出に失敗しました', {
      status: 500,
    });
  }
}
export async function GET() {
  const session = await auth();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  const userEmail = session.user?.email;
  if (!userEmail) {
    return new Response('Unauthorized', { status: 401 });
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
    return new Response(
      JSON.stringify(
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
        }))
      ),
      { status: 200 }
    );
  } catch (error) {
    return new Response('貸出状況の取得に失敗しました', {
      status: 500,
    });
  }
}
