import { readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/admin/genre-points/route";
import { Admin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/admin", () => ({ Admin: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
  },
}));

type GenrePointResponse = {
  rows: {
    month: string;
    tagId: string;
    tagName: string;
    points: number;
  }[];
  predictions: {
    month: string;
    tagId: string;
    tagName: string;
    points: number;
  }[];
};

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedAdmin = Admin as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

function readDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  try {
    const envFile = readFileSync(".env.local", "utf8");
    const databaseUrlLine = envFile
      .split(/\r?\n/)
      .find((line) => line.startsWith("TEST_DATABASE_URL="));

    if (!databaseUrlLine) return undefined;

    return databaseUrlLine
      .slice("TEST_DATABASE_URL=".length)
      .trim()
      .replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

function toJapanMonthKey(value: string) {
  const date = new Date(value);
  const year = date.toLocaleString("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
  });
  const month = date.toLocaleString("en-US", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
  });

  return `${year}-${month}`;
}

function findRow(body: GenrePointResponse, monthKey: string, tagName: string) {
  return body.rows.find(
    (row) => toJapanMonthKey(row.month) === monthKey && row.tagName === tagName
  );
}

async function createTempTables(client: Client) {
  await client.query(`DROP TABLE IF EXISTS pg_temp."GenrePointPrediction"`);
  await client.query(`DROP TABLE IF EXISTS pg_temp."CommentBookLink"`);
  await client.query(`DROP TABLE IF EXISTS pg_temp."ThreadComment"`);
  await client.query(`DROP TABLE IF EXISTS pg_temp."Thread"`);
  await client.query(`DROP TABLE IF EXISTS pg_temp."AiRecommendation"`);
  await client.query(`DROP TABLE IF EXISTS pg_temp."ResearchEvent"`);
  await client.query(`DROP TABLE IF EXISTS pg_temp."Loan"`);
  await client.query(`DROP TABLE IF EXISTS pg_temp."SearchEventTag"`);
  await client.query(`DROP TABLE IF EXISTS pg_temp."SearchEvent"`);
  await client.query(`DROP TABLE IF EXISTS pg_temp."BookTag"`);
  await client.query(`DROP TABLE IF EXISTS pg_temp."TagList"`);

  await client.query(
    `CREATE TEMP TABLE "TagList" (
       id TEXT PRIMARY KEY,
       tag TEXT NOT NULL
     )`
  );
  await client.query(
    `CREATE TEMP TABLE "GenrePointPrediction" (
       "predictionMonth" DATE NOT NULL,
       "tagId" TEXT NOT NULL,
       "predictedPoints" DOUBLE PRECISION NOT NULL
     )`
  );
  await client.query(
    `CREATE TEMP TABLE "BookTag" (
       "bookId" TEXT NOT NULL,
       "tagId" TEXT NOT NULL
     )`
  );
  await client.query(
    `CREATE TEMP TABLE "SearchEvent" (
       id TEXT PRIMARY KEY,
       "userEmail" TEXT NOT NULL,
       "searchType" TEXT NOT NULL,
       query TEXT NOT NULL,
       "occurredAt" TIMESTAMP(3) NOT NULL
     )`
  );
  await client.query(
    `CREATE TEMP TABLE "SearchEventTag" (
       "searchEventId" TEXT NOT NULL,
       "tagId" TEXT NOT NULL,
       confidence REAL NOT NULL
     )`
  );
  await client.query(
    `CREATE TEMP TABLE "Loan" (
       id TEXT PRIMARY KEY,
       "userEmail" TEXT NOT NULL,
       "bookId" TEXT NOT NULL,
       "loanedAt" TIMESTAMPTZ NOT NULL,
       "returnedAt" TIMESTAMPTZ
     )`
  );
  await client.query(
    `CREATE UNIQUE INDEX "Loan_one_active_per_book"
     ON "Loan" ("bookId") WHERE "returnedAt" IS NULL`
  );
  await client.query(
    `CREATE TEMP TABLE "ResearchEvent" (
       id TEXT PRIMARY KEY,
       "eventType" TEXT NOT NULL,
       "userEmail" TEXT NOT NULL,
       "bookId" TEXT NOT NULL,
       "sourceType" TEXT NOT NULL,
       "sourceId" TEXT,
       "occurredAt" TIMESTAMP(3) NOT NULL
     )`
  );
  await client.query(
    `CREATE TEMP TABLE "AiRecommendation" (
       id TEXT PRIMARY KEY,
       "bookId" TEXT NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL,
       "userEmail" TEXT NOT NULL,
       query TEXT NOT NULL,
       reason TEXT NOT NULL,
       rank INTEGER NOT NULL
     )`
  );
  await client.query(
    `CREATE TEMP TABLE "Thread" (
       id TEXT PRIMARY KEY,
       kind TEXT NOT NULL,
       "bookId" TEXT,
       "userEmail" TEXT NOT NULL,
       content TEXT NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL
     )`
  );
  await client.query(
    `CREATE TEMP TABLE "ThreadComment" (
       id TEXT PRIMARY KEY,
       "threadId" TEXT NOT NULL,
       "parentCommentId" TEXT,
       "userEmail" TEXT NOT NULL,
       content TEXT NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL
     )`
  );
  await client.query(
    `CREATE TEMP TABLE "CommentBookLink" (
       id TEXT PRIMARY KEY,
       "commentId" TEXT NOT NULL,
       "bookId" TEXT NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL
     )`
  );
}

async function seedAggregationData(client: Client) {
  await client.query(
    `INSERT INTO "TagList" (id, tag)
     VALUES
       ('tag-design', 'デザイン'),
       ('tag-tech', '技術書')`
  );
  await client.query(
    `INSERT INTO "BookTag" ("bookId", "tagId")
     VALUES
       ('book-design-1', 'tag-design'),
       ('book-design-2', 'tag-design'),
       ('book-tech-1', 'tag-tech')`
  );
  await client.query(
    `INSERT INTO "SearchEvent" (id, "userEmail", "searchType", query, "occurredAt")
     VALUES ('search-design-1', 'user@example.com', 'book_list', 'design', '2026-04-10 10:00:00')`
  );
  await client.query(
    `INSERT INTO "SearchEventTag" ("searchEventId", "tagId", confidence)
     VALUES ('search-design-1', 'tag-design', 0.8)`
  );
  await client.query(
    `INSERT INTO "Loan" (id, "userEmail", "bookId", "loanedAt", "returnedAt")
     VALUES
       ('loan-design-1', 'user@example.com', 'book-design-1', '2026-04-11 10:00:00', '2026-04-20 10:00:00'),
       ('loan-design-2', 'user@example.com', 'book-design-2', '2026-04-12 10:00:00', NULL),
       ('loan-design-3', 'user@example.com', 'book-design-1', '2026-05-01 10:00:00', NULL),
       ('loan-tech-1', 'user@example.com', 'book-tech-1', '2026-04-13 10:00:00', NULL)`
  );
  await client.query(
    `INSERT INTO "ResearchEvent"
       (id, "eventType", "userEmail", "bookId", "sourceType", "sourceId", "occurredAt")
     VALUES
       ('design-detail-1', 'book_detail_view', 'user@example.com', 'book-design-1', 'direct', NULL, '2026-04-14 10:00:00'),
       ('design-post-view-1', 'post_view', 'user@example.com', 'book-design-1', 'thread', NULL, '2026-04-15 10:00:00'),
       ('design-thread-click-1', 'book_link_click', 'user@example.com', 'book-design-1', 'thread', NULL, '2026-04-16 10:00:00')`
  );
  await client.query(
    `INSERT INTO "Thread" (id, kind, "bookId", "userEmail", content, "createdAt")
     VALUES ('thread-design-1', 'BOOK_TOPIC', 'book-design-1', 'user@example.com', 'thread', '2026-04-17 10:00:00')`
  );
}

const databaseUrl =
  process.env.RUN_DB_TESTS === "1" ? readDatabaseUrl() : undefined;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("GET /api/admin/genre-points SQL aggregation", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(`SET TIME ZONE 'Asia/Tokyo'`);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
    mockedQuery.mockImplementation((text: string, params: unknown[] = []) =>
      client.query(text, params)
    );

    await createTempTables(client);
  });

  afterAll(async () => {
    await client.end();
  });

  it("同じ月の同じタグを1行にまとめてpointsを合計する", async () => {
    await seedAggregationData(client);
    await client.query(
      `INSERT INTO "GenrePointPrediction"
         ("predictionMonth", "tagId", "predictedPoints")
       VALUES
         ('2026-05-01', 'tag-design', 12.5),
         ('2026-05-01', 'tag-tech', 8.25)`
    );

    const response = await GET(
      new Request("http://localhost/api/admin/genre-points")
    );
    const body: GenrePointResponse = await response.json();

    const designApril = findRow(body, "2026-04", "デザイン");
    const techApril = findRow(body, "2026-04", "技術書");
    const designMay = findRow(body, "2026-05", "デザイン");

    expect(response.status).toBe(200);
    expect(designApril).toMatchObject({
      tagId: "tag-design",
      tagName: "デザイン",
    });
    expect(designApril?.points).toBeCloseTo(26.8);

    expect(techApril).toMatchObject({
      tagId: "tag-tech",
      tagName: "技術書",
    });
    expect(techApril?.points).toBeCloseTo(10);

    expect(designMay).toMatchObject({
      tagId: "tag-design",
      tagName: "デザイン",
    });
    expect(designMay?.points).toBeCloseTo(10);
    expect(body.rows).toHaveLength(3);
    expect(body.predictions).toEqual([
      {
        month: "2026-05-01",
        tagId: "tag-design",
        tagName: "デザイン",
        points: 12.5,
      },
      {
        month: "2026-05-01",
        tagId: "tag-tech",
        tagName: "技術書",
        points: 8.25,
      },
    ]);
  });

  it("11種類すべての行動を指定した重みで同じ月・タグへ集約する", async () => {
    await client.query(`INSERT INTO "TagList" (id, tag) VALUES ('tag-all', '全種類')`);
    await client.query(`INSERT INTO "BookTag" ("bookId", "tagId") VALUES ('book-all', 'tag-all')`);
    await client.query(`
      INSERT INTO "SearchEvent" (id, "userEmail", "searchType", query, "occurredAt") VALUES
        ('search-book', 'user@example.com', 'book_list', 'book', '2026-04-01 10:00:00'),
        ('search-ai', 'user@example.com', 'ai_query', 'ai', '2026-04-02 10:00:00')
    `);
    await client.query(`
      INSERT INTO "SearchEventTag" ("searchEventId", "tagId", confidence) VALUES
        ('search-book', 'tag-all', 1),
        ('search-ai', 'tag-all', 1)
    `);
    await client.query(`
      INSERT INTO "Loan" (id, "userEmail", "bookId", "loanedAt")
      VALUES ('loan-all', 'user@example.com', 'book-all', '2026-04-03 10:00:00')
    `);
    await client.query(`
      INSERT INTO "ResearchEvent"
        (id, "eventType", "userEmail", "bookId", "sourceType", "sourceId", "occurredAt") VALUES
        ('detail', 'book_detail_view', 'user@example.com', 'book-all', 'direct', NULL, '2026-04-04 10:00:00'),
        ('post', 'post_view', 'user@example.com', 'book-all', 'thread', NULL, '2026-04-05 10:00:00'),
        ('thread-click', 'book_link_click', 'user@example.com', 'book-all', 'thread', NULL, '2026-04-06 10:00:00'),
        ('comment-click', 'book_link_click', 'user@example.com', 'book-all', 'comment', NULL, '2026-04-07 10:00:00'),
        ('ai-click', 'book_link_click', 'user@example.com', 'book-all', 'ai_chat', NULL, '2026-04-08 10:00:00')
    `);
    await client.query(`
      INSERT INTO "AiRecommendation"
        (id, "bookId", "createdAt", "userEmail", query, reason, rank)
      VALUES ('ai-rec', 'book-all', '2026-04-09 10:00:00', 'user@example.com', 'query', 'reason', 1)
    `);
    await client.query(`
      INSERT INTO "Thread" (id, kind, "bookId", "userEmail", content, "createdAt")
      VALUES ('thread-all', 'BOOK_TOPIC', 'book-all', 'user@example.com', 'thread', '2026-04-10 10:00:00')
    `);
    await client.query(`
      INSERT INTO "ThreadComment"
        (id, "threadId", "parentCommentId", "userEmail", content, "createdAt")
      VALUES ('comment-all', 'thread-all', NULL, 'user@example.com', 'comment', '2026-04-11 10:00:00')
    `);
    await client.query(`
      INSERT INTO "CommentBookLink" (id, "commentId", "bookId", "createdAt")
      VALUES ('link-all', 'comment-all', 'book-all', '2026-04-11 10:00:00')
    `);

    const params = new URLSearchParams({
      searchBookList: "1",
      searchAiQuery: "1",
      loan: "1",
      bookDetailView: "1",
      postView: "1",
      threadBookLinkClick: "1",
      commentBookLinkClick: "1",
      aiBookLinkClick: "1",
      aiRecommendationView: "1",
      threadCreate: "1",
      commentCreate: "1",
    });
    const response = await GET(
      new Request(`http://localhost/api/admin/genre-points?${params}`)
    );
    const body: GenrePointResponse = await response.json();

    expect(response.status).toBe(200);
    expect(findRow(body, "2026-04", "全種類")?.points).toBe(11);
  });

  it("月末23時59分と翌月0時を別の月へ集約する", async () => {
    await client.query(`INSERT INTO "TagList" (id, tag) VALUES ('tag-boundary', '境界')`);
    await client.query(`INSERT INTO "BookTag" ("bookId", "tagId") VALUES ('book-boundary', 'tag-boundary')`);
    await client.query(`
      INSERT INTO "Loan" (id, "userEmail", "bookId", "loanedAt", "returnedAt") VALUES
        ('april', 'user@example.com', 'book-boundary', '2026-04-30 23:59:59.999', '2026-04-30 23:59:59.999'),
        ('may', 'user@example.com', 'book-boundary', '2026-05-01 00:00:00.000', NULL)
    `);

    const response = await GET(
      new Request("http://localhost/api/admin/genre-points?loan=1")
    );
    const body: GenrePointResponse = await response.json();

    expect(findRow(body, "2026-04", "境界")?.points).toBe(1);
    expect(findRow(body, "2026-05", "境界")?.points).toBe(1);
  });
});
