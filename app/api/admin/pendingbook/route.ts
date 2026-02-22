import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { randomUUID } from "crypto";

const ISBN13_REGEX = /^97[89]\d{10}$/;

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const email = session.user?.email;
    const isAdmin = email ? await Admin(email) : false;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pendingBooks = await db.query(
      `SELECT * FROM "PendingBook" ORDER BY "createdAt" DESC`
    );

    return NextResponse.json(pendingBooks.rows, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch pending books" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const email = session.user?.email;
    const isAdmin = email ? await Admin(email) : false;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await request.json();
    const isString = (v: unknown): v is string => typeof v === "string";
    const isStringArray = (v: unknown): v is string[] =>
      Array.isArray(v) && v.every(isString);

    const googleBookId = isString(data.googleBookId) ? data.googleBookId : null;
    const isbn13 = isString(data.isbn13) ? data.isbn13 : "";
    const title = isString(data.title) ? data.title : "";
    const authors = isStringArray(data.authors) ? data.authors : [];
    const description = isString(data.description) ? data.description : null;
    const thumbnail = isString(data.thumbnail) ? data.thumbnail : null;

    if (!isbn13 || !ISBN13_REGEX.test(isbn13)) {
      return NextResponse.json({ error: "Invalid isbn13" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }

    const existing = await db.query(
      `SELECT id FROM "PendingBook" WHERE isbn13 = $1 LIMIT 1`,
      [isbn13]
    );

    const pendingBook = await db.query(
      `INSERT INTO "PendingBook" (id, "googleBookId", isbn13, title, authors, description, thumbnail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (isbn13)
       DO UPDATE SET
         "googleBookId" = EXCLUDED."googleBookId",
         title = EXCLUDED.title,
         authors = EXCLUDED.authors,
         description = EXCLUDED.description,
         thumbnail = EXCLUDED.thumbnail
       RETURNING *`,
      [
        randomUUID(),
        googleBookId,
        isbn13,
        title,
        authors,
        description,
        thumbnail,
      ]
    );


    return NextResponse.json(pendingBook.rows[0], {
      status: (existing.rowCount ?? 0) > 0 ? 200 : 201,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create pending book" },
      { status: 500 }
    );
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const email = session.user?.email;
    const isAdmin = email ? await Admin(email) : false;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await request.json();

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }


    const deleted = await db.query(
      `DELETE FROM "PendingBook" WHERE id = $1 RETURNING id`,
      [id]
    );
    if ((deleted.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Pending book not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Pending book deleted" }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete pending book" },
      { status: 500 }
    );
  }
}
