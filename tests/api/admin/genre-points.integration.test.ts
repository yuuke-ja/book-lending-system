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
};

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedAdmin = Admin as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  try {
    const envFile = readFileSync(".env.local", "utf8");
    const databaseUrlLine = envFile
      .split(/\r?\n/)
      .find((line) => line.startsWith("DATABASE_URL="));

    if (!databaseUrlLine) return undefined;

    return databaseUrlLine
      .slice("DATABASE_URL=".length)
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
       "loanedAt" TIMESTAMP(3) NOT NULL
     )`
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
    `INSERT INTO "Loan" (id, "userEmail", "bookId", "loanedAt")
     VALUES
       ('loan-design-1', 'user@example.com', 'book-design-1', '2026-04-11 10:00:00'),
       ('loan-design-2', 'user@example.com', 'book-design-2', '2026-04-12 10:00:00'),
       ('loan-design-3', 'user@example.com', 'book-design-1', '2026-05-01 10:00:00'),
       ('loan-tech-1', 'user@example.com', 'book-tech-1', '2026-04-13 10:00:00')`
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
     VALUES ('thread-design-1', 'book', 'book-design-1', 'user@example.com', 'thread', '2026-04-17 10:00:00')`
  );
}

const databaseUrl = readDatabaseUrl();
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
  });
});
