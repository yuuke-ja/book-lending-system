import { NextRequest, NextResponse } from 'next/server';
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { randomUUID } from "crypto";
export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const email = session.user?.email;
  const isAdmin = email ? await Admin(email) : false;
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const pending = await db.query(
      `SELECT * FROM "PendingBook"`
    );

    await db.transaction(async (tx) => {
      for (const pb of pending.rows) {
        //PendingBookをBookに登録または更新
        const savedbook = await tx.query(
          `INSERT INTO "Book" (id, "googleBookId", isbn13, title, authors, description, thumbnail)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (isbn13)
           DO UPDATE SET
             "googleBookId" = EXCLUDED."googleBookId",
             title = EXCLUDED.title,
             authors = EXCLUDED.authors,
             description = EXCLUDED.description,
             thumbnail = EXCLUDED.thumbnail
           RETURNING id, title, authors, description`,
          [
            randomUUID(),
            pb.googleBookId,
            pb.isbn13,
            pb.title,
            pb.authors,
            pb.description,
            pb.thumbnail,
          ]
        );
        const book = savedbook.rows[0];
        const searchText = `${book.title} ${(book.authors ?? []).join(" ")} ${book.description ?? ""}`.toLowerCase();
        await tx.query(`DELETE FROM "BookTag" WHERE "bookId" = $1`, [book.id]);
        await tx.query(
          `INSERT INTO "BookTag" ("bookId", "tagId")
           SELECT $1, t.id
           FROM "TagList" t
           WHERE $2 LIKE '%' || lower(t.tag) || '%'
           ON CONFLICT ("bookId", "tagId") DO NOTHING`,
          [book.id, searchText]
        );

      }
      await tx.query(`DELETE FROM "PendingBook"`);
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
