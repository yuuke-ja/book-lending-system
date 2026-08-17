import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "pg";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET as fullTextSearch } from "@/app/api/book/search/full-text/route";
import { GET as tagSearch } from "@/app/api/book/search/tag/route";
import {
  connectIntegrationClient,
  dropTempTables,
  getIntegrationDatabaseUrl,
  withTempTableSetup,
} from "./postgres-test-utils";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));

const databaseUrl = getIntegrationDatabaseUrl();
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const mockedAuth = vi.mocked(auth);
const mockedQuery = vi.mocked(db.query);

async function createSearchTables(client: Client, pgroongaAvailable: boolean) {
  await dropTempTables(client, ["BookReview", "BookTag", "TagList", "Book"]);
  await client.query(`
    CREATE TEMP TABLE "Book" (
      id TEXT PRIMARY KEY,
      "googleBookId" TEXT,
      isbn13 TEXT NOT NULL,
      title TEXT NOT NULL,
      authors TEXT[] NOT NULL DEFAULT '{}',
      description TEXT,
      thumbnail TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "BookReview" (
      id TEXT PRIMARY KEY,
      "bookId" TEXT NOT NULL,
      "userEmail" TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      FOREIGN KEY ("bookId") REFERENCES "Book"(id),
      UNIQUE ("bookId", "userEmail")
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "TagList" (
      id TEXT PRIMARY KEY,
      tag TEXT NOT NULL
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "BookTag" (
      "bookId" TEXT NOT NULL,
      "tagId" TEXT NOT NULL,
      UNIQUE ("bookId", "tagId")
    )
  `);
  if (pgroongaAvailable) {
    await client.query(`
      CREATE INDEX "Book_full_text_pgroonga_test_idx"
      ON "Book" USING pgroonga (title, authors, description)
    `);
  }
}

describeWithDatabase("全文・タグ検索RouteとPostgreSQLの結合", () => {
  let client: Client;
  let pgroongaAvailable = false;

  beforeAll(async () => {
    client = await connectIntegrationClient(databaseUrl!);
    const extension = await client.query<{ available: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_extension WHERE extname = 'pgroonga'
       ) AS available`
    );
    pgroongaAvailable = extension.rows[0].available;
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({
      user: { email: "user@example.com" },
    } as never);
    mockedQuery.mockImplementation((text, params = []) =>
      client.query(text, params)
    );
    await withTempTableSetup(client, async () => {
      await createSearchTables(client, pgroongaAvailable);
      await client.query(`
        INSERT INTO "Book"
          (id, "googleBookId", isbn13, title, authors, description, "createdAt")
        VALUES
          ('book-react', 'g-1', '9780000000001', 'React入門', ARRAY['山田'],
           'フロントエンド開発の入門書', '2026-08-01T00:00:00Z'),
          ('book-db', 'g-2', '9780000000002', 'データベース設計', ARRAY['佐藤'],
           'PostgreSQLとSQLを解説', '2026-08-02T00:00:00Z'),
          ('book-both', 'g-3', '9780000000003', 'ReactとDB設計', ARRAY['鈴木'],
           'Webアプリの設計', '2026-08-03T00:00:00Z')
      `);
      await client.query(`
        INSERT INTO "TagList" (id, tag) VALUES
          ('tag-web', 'Web'),
          ('tag-db', 'DB')
      `);
      await client.query(`
        INSERT INTO "BookTag" ("bookId", "tagId") VALUES
          ('book-react', 'tag-web'),
          ('book-db', 'tag-db'),
          ('book-both', 'tag-web'),
          ('book-both', 'tag-db')
      `);
      await client.query(`
        INSERT INTO "BookReview" (id, "bookId", "userEmail", rating) VALUES
          ('review-1', 'book-react', 'reviewer-1@example.com', 4),
          ('review-2', 'book-react', 'reviewer-2@example.com', 5)
      `);
    });
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it("タグIDに一致する本だけを取得し、タグと平均評価を集約する", async () => {
    const response = await tagSearch(
      new Request("http://localhost/api/book/search/tag?tagIds=tag-web")
    );
    const books = await response.json();

    expect(response.status).toBe(200);
    expect(books.map((book: { id: string }) => book.id)).toEqual([
      "book-both",
      "book-react",
    ]);
    const react = books.find(
      (book: { id: string }) => book.id === "book-react"
    );
    expect(react.averageRating).toBe(4.5);
    expect(react.tags).toEqual([{ id: "tag-web", tag: "Web" }]);
  });

  it("複数タグIDはOR検索となり同じ本を重複させない", async () => {
    const response = await tagSearch(
      new Request(
        "http://localhost/api/book/search/tag?tagIds=tag-web,tag-db&tagIds=tag-web"
      )
    );
    const books = await response.json();

    expect(response.status).toBe(200);
    expect(books.map((book: { id: string }) => book.id)).toEqual([
      "book-both",
      "book-db",
      "book-react",
    ]);
  });

  it("タグ名queryだけではDB検索せず空配列を返す", async () => {
    vi.clearAllMocks();
    const response = await tagSearch(
      new Request("http://localhost/api/book/search/tag?query=Web")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("PGroongaでタイトル・著者・説明の複数語全文検索を行う", async ({
    skip,
  }) => {
    if (!pgroongaAvailable) skip();

    const response = await fullTextSearch(
      new Request(
        `http://localhost/api/book/search/full-text?query=${encodeURIComponent(
          "React、PostgreSQL"
        )}`
      )
    );
    const books = await response.json();

    expect(response.status).toBe(200);
    expect(books.map((book: { id: string }) => book.id)).toEqual(
      expect.arrayContaining(["book-react", "book-db", "book-both"])
    );
  });

  it("検索欄に小文字のwebを入力すると大文字のWebを含む本を取得する", async ({
    skip,
  }) => {
    if (!pgroongaAvailable) skip();

    const response = await fullTextSearch(
      new Request("http://localhost/api/book/search/full-text?query=web")
    );
    const books = await response.json();

    expect(response.status).toBe(200);
    expect(books.map((book: { id: string }) => book.id)).toContain("book-both");
  });

  for (const [field, query, expectedIds] of [
    ["タイトル", "React", ["book-react", "book-both"]],
    ["著者", "山田", ["book-react"]],
    ["説明", "SQL", ["book-db"]],
  ] as const) {
    it(`${field}に入力語がある本を実データから取得する`, async ({ skip }) => {
      if (!pgroongaAvailable) skip();

      const response = await fullTextSearch(
        new Request(
          `http://localhost/api/book/search/full-text?query=${encodeURIComponent(query)}`
        )
      );
      const books = await response.json();

      expect(response.status).toBe(200);
      expect(books.map((book: { id: string }) => book.id)).toEqual(
        expect.arrayContaining([...expectedIds])
      );
    });
  }

  it("一致しない全文検索語なら空配列を返す", async ({ skip }) => {
    if (!pgroongaAvailable) skip();

    const response = await fullTextSearch(
      new Request(
        `http://localhost/api/book/search/full-text?query=${encodeURIComponent("量子力学")}`
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it("タグ検索結果に選択外を含む全タグとレビューなし平均0を付ける", async () => {
    const response = await tagSearch(
      new Request("http://localhost/api/book/search/tag?tagIds=tag-web")
    );
    const books = await response.json();
    const both = books.find((book: { id: string }) => book.id === "book-both");

    expect(both.averageRating).toBe(0);
    expect(both.tags).toEqual([
      { id: "tag-db", tag: "DB" },
      { id: "tag-web", tag: "Web" },
    ]);
  });

  it("全文検索語をSQLとして解釈せず、テーブルを保持する", async ({ skip }) => {
    if (!pgroongaAvailable) skip();

    const response = await fullTextSearch(
      new Request(
        `http://localhost/api/book/search/full-text?query=${encodeURIComponent(
          "'); DROP TABLE \"Book\"; --"
        )}`
      )
    );

    expect(response.status).toBe(200);
    const count = await client.query(`SELECT COUNT(*)::int AS count FROM "Book"`);
    expect(count.rows[0].count).toBe(3);
  });
});
