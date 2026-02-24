import { NextRequest, NextResponse } from 'next/server';
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userEmail = session.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const borrowedList = await db.query(
      `SELECT DISTINCT ON(l."bookId")
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
       WHERE l."userEmail" = $1
       ORDER BY l."bookId", l."loanedAt" DESC`,

      [userEmail]
    );
    return new Response(
      JSON.stringify(
        borrowedList.rows.map((loan) => ({
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
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
