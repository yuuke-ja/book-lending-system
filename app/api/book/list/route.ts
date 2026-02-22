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
      'SELECT * FROM "Book" ORDER BY "createdAt" DESC'
    );
    return NextResponse.json(books.rows, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch books' },
      { status: 500 }
    );
  }
}