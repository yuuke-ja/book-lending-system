import { NextRequest, NextResponse } from 'next/server';
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { createEmbedding } from "../embedding";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const email = session.user?.email;
  const isAdmin = email ? await Admin(email) : false;
  if (!isAdmin) return NextResponse.json({ error: "管理者以外はアクセスできません" }, { status: 403 });
  // すべての本の情報を取得
  const bookDB = (await db.query(
    `SELECT
       b.id,
       b.title,
       b.authors,
       b.description,
       string_agg(t.tag, ',') AS tags
       FROM "Book" b
       LEFT JOIN "BookTag" bt ON bt."bookId" = b.id
       LEFT JOIN "TagList" t ON t.id = bt."tagId"
       GROUP BY b.id`
  )).rows
  const embeddings = [];
  for (const book of bookDB) {
    const content = [
      book.title,
      book.authors ? book.authors.join(' ') : '',
      book.description,
      book.tags || '',]
    const embedding = await createEmbedding(content, "passage");
    embeddings.push({
      bookId: book.id,
      content,
      embedding
    });
  }
  //　ベクトルを保存
  if (embeddings.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const values = embeddings
    .map((_, index) => {
      const base = index * 3;
      return `($${base + 1}, $${base + 2}, $${base + 3}::vector, now())`;
    })
    .join(", ");

  const params = embeddings.flatMap((e) => [
    e.bookId,
    e.content.filter(Boolean).join('\n'),
    `[${e.embedding.join(",")}]`,
  ]);

  await db.query(
    `INSERT INTO "BookEmbedding" ("bookId", content, embedding, "updatedAt")
     VALUES ${values}
     ON CONFLICT ("bookId") DO UPDATE
     SET
       content = EXCLUDED.content,
       embedding = EXCLUDED.embedding,
       "updatedAt" = now()`,
    params
  );

  return NextResponse.json({ ok: true, count: embeddings.length });




}
