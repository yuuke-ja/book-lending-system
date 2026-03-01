import { NextResponse } from 'next/server';
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const books = await db.query(
      `SELECT
        b.id,
        b.isbn13,
        b.title,
        b.authors,
        b.description,
        b.thumbnail,
        b."createdAt",
        COALESCE(AVG(br.rating), 0)::float AS "averageRating",
        COUNT(br.id)::int AS "ratingCount"
      FROM "Book" b
      LEFT JOIN "BookReview" br ON br."bookId" = b.id
      GROUP BY b.id, b.isbn13, b.title, b.authors, b.description, b.thumbnail, b."createdAt"
      ORDER BY b."createdAt" DESC`

    );
    return NextResponse.json(books.rows, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch books' },
      { status: 500 }
    );
  }
}