import { NextRequest, NextResponse } from 'next/server';
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { randomUUID } from "crypto";

type SavedBookRow = {
  id: string;
  title: string;
  authors: string[] | null;
  description: string | null;
};

type TagTokenRow = {
  id: string;
  tag: string;
  tokens: string[] | null;
};

type TokenRow = {
  tokens: string[] | null;
};

function hasMatchingTagTokens(bookTokens: string[], tagTokens: string[]) {
  if (tagTokens.length === 0) return false;
  if (tagTokens.length === 1 && /^[a-z]$/i.test(tagTokens[0])) return false;

  for (let start = 0; start <= bookTokens.length - tagTokens.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < tagTokens.length; offset += 1) {
      if (bookTokens[start + offset] !== tagTokens[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }

  return false;
}

export async function POST(_request: NextRequest) {
  void _request;
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
      //タグ単語化
      const tagRows = await tx.query<TagTokenRow>(
        `SELECT
           t.id,
           t.tag,
           ARRAY(
             SELECT lower(token.value)
             FROM unnest(pgroonga_tokenize(lower(t.tag), 'tokenizer', 'TokenMecab')) AS raw(token_json)
             CROSS JOIN LATERAL jsonb_to_record(raw.token_json::jsonb) AS token(value text)
             WHERE coalesce(token.value, '') <> ''
           ) AS tokens
         FROM "TagList" t`
      );

      for (const pb of pending.rows) {
        //PendingBookをBookに登録または更新
        const savedbook = await tx.query<SavedBookRow>(
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
        const searchText = `${book.title} ${(book.authors ?? []).join(" ")} ${book.description ?? ""}`;
        //本の情報単語化
        const tokenResult = await tx.query<TokenRow>(
          `SELECT ARRAY(
             SELECT lower(token.value)
             FROM unnest(pgroonga_tokenize(lower($1), 'tokenizer', 'TokenMecab')) AS raw(token_json)
             CROSS JOIN LATERAL jsonb_to_record(raw.token_json::jsonb) AS token(value text)
             WHERE coalesce(token.value, '') <> ''
           ) AS tokens`,
          [searchText]
        );
        const bookTokens = tokenResult.rows[0]?.tokens ?? [];
        const matchedTagIds = tagRows.rows
          .filter((tagRow) => hasMatchingTagTokens(bookTokens, tagRow.tokens ?? []))
          .map((tagRow) => tagRow.id);

        await tx.query(`DELETE FROM "BookTag" WHERE "bookId" = $1`, [book.id]);
        if (matchedTagIds.length > 0) {
          await tx.query(
            `INSERT INTO "BookTag" ("bookId", "tagId")
             SELECT $1, tag_id
             FROM unnest($2::text[]) AS tag_id
             ON CONFLICT ("bookId", "tagId") DO NOTHING`,
            [book.id, matchedTagIds]
          );
        }

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
