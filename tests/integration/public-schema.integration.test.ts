import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { db } from "@/lib/db";
import { getBookList } from "@/lib/books/get-book-list";
import { getBookById } from "@/lib/books/get-book-by-id";
import { getIntegrationDatabaseUrl } from "./postgres-test-utils";

vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));

const databaseUrl = getIntegrationDatabaseUrl();
function isDisposableLocalDatabase(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      url.port === "55432" &&
      url.pathname === "/book_lending_test"
    );
  } catch {
    return false;
  }
}

const describeWithLocalDatabase = isDisposableLocalDatabase(databaseUrl)
  ? describe
  : describe.skip;
const mockedQuery = vi.mocked(db.query);

describeWithLocalDatabase("migrationで作成したpublicスキーマとの結合", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(`SET TIME ZONE 'Asia/Tokyo'`);
    await client.query(`SET search_path = public`);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await client.query("BEGIN");
    mockedQuery.mockImplementation((text, params = []) => client.query(text, params));
  });

  afterEach(async () => {
    await client.query("ROLLBACK");
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it("実際のBook・BookReview・BookTag定義へ保存し、一覧と詳細を取得する", async () => {
    await client.query(`
      INSERT INTO "Book"
        (id, isbn13, title, authors, description, "createdAt")
      VALUES
        ('public-book', '9789999999991', 'public実表の本', ARRAY['実著者'], '実説明',
         '2026-08-16T00:00:00Z')
    `);
    await client.query(`
      INSERT INTO "BookReview" (id, "bookId", "userEmail", rating)
      VALUES ('public-review', 'public-book', 'public@example.com', 5)
    `);
    await client.query(`
      INSERT INTO "TagList" (id, tag)
      VALUES ('public-tag', '実タグ')
    `);
    await client.query(`
      INSERT INTO "BookTag" ("bookId", "tagId")
      VALUES ('public-book', 'public-tag')
    `);

    const list = await getBookList();
    const detail = await getBookById("public-book");

    expect(list.find((book) => book.id === "public-book")).toMatchObject({
      averageRating: 5,
      tags: [{ id: "public-tag", tag: "実タグ" }],
    });
    expect(detail).toMatchObject({
      id: "public-book",
      ratingCount: 1,
      averageRating: 5,
      tags: [{ id: "public-tag", tag: "実タグ" }],
    });
  });

  it("実際の評価範囲制約が1〜5以外を拒否する", async () => {
    await client.query(`
      INSERT INTO "Book" (id, isbn13, title, authors)
      VALUES ('constraint-book', '9789999999992', '制約本', ARRAY['著者'])
    `);
    await client.query("SAVEPOINT before_invalid_rating");

    await expect(
      client.query(`
        INSERT INTO "BookReview" (id, "bookId", "userEmail", rating)
        VALUES ('invalid-rating', 'constraint-book', 'public@example.com', 6)
      `)
    ).rejects.toMatchObject({ code: "23514" });

    await client.query("ROLLBACK TO SAVEPOINT before_invalid_rating");
  });

  it("実際の部分UNIQUE INDEXが同じ本の未返却貸出を2件作らせない", async () => {
    await client.query(`
      INSERT INTO "Book" (id, isbn13, title, authors)
      VALUES ('active-loan-book', '9789999999993', '貸出制約本', ARRAY['著者'])
    `);
    await client.query(`
      INSERT INTO "Loan" (id, "userEmail", "bookId")
      VALUES ('active-loan-1', 'one@example.com', 'active-loan-book')
    `);
    await client.query("SAVEPOINT before_duplicate_loan");

    await expect(
      client.query(`
        INSERT INTO "Loan" (id, "userEmail", "bookId")
        VALUES ('active-loan-2', 'two@example.com', 'active-loan-book')
      `)
    ).rejects.toMatchObject({ code: "23505" });

    await client.query("ROLLBACK TO SAVEPOINT before_duplicate_loan");
  });

  it("ローカルmigration適用後は指定した9テーブルだけRLSが有効でLoanは無効", async () => {
    const result = await client.query<{ tablename: string; rls: boolean }>(`
      SELECT c.relname AS tablename, c.relrowsecurity AS rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = ANY($1::text[])
      ORDER BY c.relname
    `, [[
      "AiChatMessage",
      "AiRecommendation",
      "BookEmbedding",
      "GenrePointPrediction",
      "Notice",
      "SearchEvent",
      "SearchEventTag",
      "TagSubterm",
      "UserRecommendation",
      "Loan",
    ]]);

    const flags = Object.fromEntries(result.rows.map((row) => [row.tablename, row.rls]));
    expect(flags).toEqual({
      AiChatMessage: true,
      AiRecommendation: true,
      BookEmbedding: true,
      GenrePointPrediction: true,
      Loan: false,
      Notice: true,
      SearchEvent: true,
      SearchEventTag: true,
      TagSubterm: true,
      UserRecommendation: true,
    });
  });
});
