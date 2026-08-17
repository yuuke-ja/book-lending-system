import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "pg";
import { db } from "@/lib/db";
import { getBookList } from "@/lib/books/get-book-list";
import { getBookById } from "@/lib/books/get-book-by-id";
import { getTagList } from "@/lib/books/get-tag-list";
import { getLoanedBookIds } from "@/lib/books/get-loaned-book-ids";
import { getBookEmbeddingCount } from "@/lib/books/get-book-embedding-count";
import { getNotices } from "@/lib/notices/get-notices";
import { loanranking } from "@/lib/ranking/loan";
import { userranking } from "@/lib/ranking/user";
import {
  getSearchHistory,
  getzerokSearchHistory,
} from "@/lib/search-history/get-search-history";
import {
  connectIntegrationClient,
  dropTempTables,
  getIntegrationDatabaseUrl,
  withTempTableSetup,
} from "./postgres-test-utils";

vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));

const databaseUrl = getIntegrationDatabaseUrl();
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const mockedQuery = vi.mocked(db.query);

async function createTables(client: Client) {
  await dropTempTables(client, [
    "SearchEvent",
    "Notice",
    "BookEmbedding",
    "Loan",
    "BookTag",
    "TagList",
    "BookReview",
    "User",
    "Book",
  ]);
  await client.query(`
    CREATE TEMP TABLE "Book" (
      id TEXT PRIMARY KEY,
      "googleBookId" TEXT,
      isbn13 TEXT NOT NULL,
      title TEXT NOT NULL,
      authors TEXT[] NOT NULL,
      description TEXT,
      thumbnail TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "User" (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      nickname TEXT,
      avatarurl TEXT
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
  await client.query(`CREATE TEMP TABLE "TagList" (id TEXT PRIMARY KEY, tag TEXT NOT NULL)`);
  await client.query(`
    CREATE TEMP TABLE "BookTag" (
      "bookId" TEXT NOT NULL,
      "tagId" TEXT NOT NULL,
      UNIQUE ("bookId", "tagId")
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "Loan" (
      id TEXT PRIMARY KEY,
      "userEmail" TEXT NOT NULL,
      "bookId" TEXT NOT NULL,
      "loanedAt" TIMESTAMPTZ NOT NULL,
      "returnedAt" TIMESTAMPTZ,
      "dueAt" TIMESTAMPTZ,
      FOREIGN KEY ("bookId") REFERENCES "Book"(id)
    )
  `);
  await client.query(`
    CREATE UNIQUE INDEX "Loan_one_active_per_book"
    ON "Loan" ("bookId") WHERE "returnedAt" IS NULL
  `);
  await client.query(`CREATE TEMP TABLE "BookEmbedding" ("bookId" TEXT PRIMARY KEY)`);
  await client.query(`
    CREATE TEMP TABLE "Notice" (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content JSONB NOT NULL,
      "contentText" TEXT NOT NULL DEFAULT '',
      "bookId" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL,
      FOREIGN KEY ("bookId") REFERENCES "Book"(id) ON DELETE SET NULL
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "SearchEvent" (
      id TEXT PRIMARY KEY,
      "userEmail" TEXT NOT NULL,
      "searchType" TEXT NOT NULL,
      query TEXT NOT NULL,
      "occurredAt" TIMESTAMPTZ NOT NULL,
      count BIGINT NOT NULL DEFAULT 0,
      CHECK ("searchType" IN ('book_list', 'ai_query'))
    )
  `);
}

async function seedBooks(client: Client) {
  await client.query(`
    INSERT INTO "Book"
      (id, "googleBookId", isbn13, title, authors, description, thumbnail, "createdAt") VALUES
      ('book-old', 'g-old', '9780000000001', '古い本', ARRAY['著者A'], '説明A', NULL,
       '2026-08-01T00:00:00Z'),
      ('book-new', 'g-new', '9780000000002', '新しい本', ARRAY['著者B'], '説明B', '/new.png',
       '2026-08-02T00:00:00Z'),
      ('book-empty', NULL, '9780000000003', '評価なし', ARRAY['著者C'], NULL, NULL,
       '2026-08-03T00:00:00Z')
  `);
  await client.query(`
    INSERT INTO "BookReview" (id, "bookId", "userEmail", rating) VALUES
      ('review-1', 'book-new', 'reviewer-1@example.com', 4),
      ('review-2', 'book-new', 'reviewer-2@example.com', 5)
  `);
  await client.query(`
    INSERT INTO "TagList" (id, tag) VALUES
      ('tag-z', '技術'),
      ('tag-a', 'Web')
  `);
  await client.query(`
    INSERT INTO "BookTag" ("bookId", "tagId") VALUES
      ('book-new', 'tag-z'),
      ('book-new', 'tag-a')
  `);
}

describeWithDatabase("書籍・通知・ランキング・履歴取得とPostgreSQLの結合", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectIntegrationClient(databaseUrl!);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedQuery.mockImplementation((text, params = []) => client.query(text, params));
    await withTempTableSetup(client, async () => {
      await createTables(client);
      await seedBooks(client);
    });
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it("書籍一覧を新しい順で返し、平均評価・全タグ・空の既定値を集約する", async () => {
    const books = await getBookList();

    expect(books.map((book) => book.id)).toEqual([
      "book-empty",
      "book-new",
      "book-old",
    ]);
    expect(books.find((book) => book.id === "book-new")).toMatchObject({
      averageRating: 4.5,
      tags: [
        { id: "tag-a", tag: "Web" },
        { id: "tag-z", tag: "技術" },
      ],
    });
    expect(books.find((book) => book.id === "book-empty")).toMatchObject({
      averageRating: 0,
      tags: [],
    });
  });

  it("書籍詳細に評価件数とタグをまとめ、存在しないIDはnullにする", async () => {
    const detail = await getBookById("book-new");

    expect(detail).toMatchObject({
      id: "book-new",
      averageRating: 4.5,
      ratingCount: 2,
    });
    expect(detail?.tags).toEqual(
      expect.arrayContaining([
        { id: "tag-a", tag: "Web" },
        { id: "tag-z", tag: "技術" },
      ])
    );
    await expect(getBookById("missing-book")).resolves.toBeNull();
  });

  it("タグを名前順で返す", async () => {
    const tags = await getTagList();
    expect(tags.map((tag) => tag.tag)).toEqual(["Web", "技術"]);
  });

  it("未返却本のIDだけを貸出日時の新しい順で返し、返却済みは除外する", async () => {
    await client.query(`
      INSERT INTO "Loan" (id, "userEmail", "bookId", "loanedAt", "returnedAt") VALUES
        ('old-active', 'a@example.com', 'book-old', '2026-08-01T00:00:00Z', NULL),
        ('new-active', 'b@example.com', 'book-new', '2026-08-03T00:00:00Z', NULL),
        ('returned', 'a@example.com', 'book-empty', '2026-08-04T00:00:00Z', '2026-08-05T00:00:00Z')
    `);

    await expect(getLoanedBookIds()).resolves.toEqual(["book-new", "book-old"]);
  });

  it("Embedding件数の文字列を数値へ変換する", async () => {
    await client.query(`
      INSERT INTO "BookEmbedding" ("bookId") VALUES
        ('book-old'), ('book-new')
    `);
    await expect(getBookEmbeddingCount()).resolves.toBe(2);
  });

  it("お知らせを新しい順で返し、本あり・本なし・削除済みの関連本を変換する", async () => {
    await client.query(`
      INSERT INTO "Notice" (id, title, content, "bookId", "createdAt") VALUES
        ('with-book', '本あり', '{"text":"a"}', 'book-new', '2026-08-01T00:00:00Z'),
        ('without-book', '本なし', '{"text":"b"}', NULL, '2026-08-02T00:00:00Z'),
        ('deleted-book-link', '削除済みの関連本', '{"text":"c"}', 'book-empty', '2026-08-03T00:00:00Z')
    `);
    await client.query(`DELETE FROM "Book" WHERE id = 'book-empty'`);

    const notices = await getNotices();

    expect(notices.map((notice) => notice.id)).toEqual([
      "deleted-book-link",
      "without-book",
      "with-book",
    ]);
    expect(notices[0].linkedBook).toBeNull();
    expect(notices[1].linkedBook).toBeNull();
    expect(notices[2].linkedBook).toMatchObject({ id: "book-new", title: "新しい本" });
  });

  it("書籍ランキングを貸出数順・同数同順位・最大10件で返す", async () => {
    const extraBooks = Array.from({ length: 9 }, (_, index) => ({
      id: `rank-book-${index}`,
      isbn: `97900000000${String(index).padStart(2, "0")}`,
      title: `順位本${index}`,
    }));
    for (const [index, book] of extraBooks.entries()) {
      await client.query(
        `INSERT INTO "Book" (id, isbn13, title, authors, "createdAt")
         VALUES ($1, $2, $3, ARRAY['著者'], CURRENT_TIMESTAMP)`,
        [book.id, book.isbn, book.title]
      );
      await client.query(
        `INSERT INTO "Loan" (id, "userEmail", "bookId", "loanedAt")
         VALUES ($1, 'rank@example.com', $2, CURRENT_TIMESTAMP)`,
        [`rank-loan-${index}`, book.id]
      );
    }
    await client.query(`
      INSERT INTO "Loan" (id, "userEmail", "bookId", "loanedAt", "returnedAt") VALUES
        ('new-1', 'rank@example.com', 'book-new', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('new-2', 'rank@example.com', 'book-new', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('old-1', 'rank@example.com', 'book-old', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('old-2', 'rank@example.com', 'book-old', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const ranking = await loanranking();

    expect(ranking).toHaveLength(10);
    const tied = ranking.filter((row) => ["book-new", "book-old"].includes(row.bookId));
    expect(tied.map((row) => row.ranking)).toEqual([1, 1]);
  });

  it("ユーザーランキングを最大5件で返し、Userが消えた利用者の貸出も保持する", async () => {
    await client.query(`
      INSERT INTO "User" (id, email, nickname, avatarurl) VALUES
        ('user-1', 'one@example.com', '一郎', '/one.png'),
        ('user-2', 'two@example.com', '二郎', NULL),
        ('user-3', 'three@example.com', '三郎', NULL),
        ('user-4', 'four@example.com', '四郎', NULL),
        ('user-5', 'five@example.com', '五郎', NULL)
    `);
    const emails = [
      "one@example.com",
      "two@example.com",
      "three@example.com",
      "four@example.com",
      "five@example.com",
      "deleted@example.com",
    ];
    for (const [index, email] of emails.entries()) {
      await client.query(
        `INSERT INTO "Loan" (id, "userEmail", "bookId", "loanedAt", "returnedAt")
         VALUES ($1, $2, 'book-old', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [`user-loan-${index}`, email]
      );
    }
    await client.query(`
      INSERT INTO "Loan" (id, "userEmail", "bookId", "loanedAt")
      VALUES ('deleted-extra', 'deleted@example.com', 'book-new', CURRENT_TIMESTAMP)
    `);

    const ranking = await userranking();

    expect(ranking).toHaveLength(5);
    expect(ranking[0]).toMatchObject({ userId: null, loanCount: 2, ranking: 1 });
    expect(ranking.slice(1).every((row) => row.loanCount === 1 && row.ranking === 2)).toBe(true);
  });

  it("検索履歴を同時刻ならID降順で最大30件にし、0件検索だけも抽出する", async () => {
    const values = Array.from({ length: 31 }, (_, index) => {
      const id = `history-${String(index).padStart(2, "0")}`;
      const type = index % 2 === 0 ? "book_list" : "ai_query";
      const count = index % 3 === 0 ? 0 : index;
      return `('${id}', 'history@example.com', '${type}', 'query-${index}', '2026-08-16T00:00:00Z', ${count})`;
    });
    await client.query(`
      INSERT INTO "SearchEvent" (id, "userEmail", "searchType", query, "occurredAt", count)
      VALUES ${values.join(",")}
    `);

    const history = await getSearchHistory();
    const zeroHistory = await getzerokSearchHistory();

    expect(history).toHaveLength(30);
    expect(history[0].query).toBe("query-30");
    expect(history.at(-1)?.query).toBe("query-1");
    expect(zeroHistory.every((row) => Number(row.count) === 0)).toBe(true);
    expect(new Set(history.map((row) => row.searchType))).toEqual(
      new Set(["book_list", "ai_query"])
    );
  });
});
