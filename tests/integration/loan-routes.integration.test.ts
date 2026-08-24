import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "pg";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET as getBookStatus } from "@/app/api/book/bookStatus/route";
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

async function createTables(client: Client) {
  await dropTempTables(client, ["Loan", "Book"]);
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
    CREATE TEMP TABLE "Loan" (
      id TEXT PRIMARY KEY,
      "userEmail" TEXT NOT NULL,
      "bookId" TEXT NOT NULL REFERENCES "Book"(id),
      "loanedAt" TIMESTAMPTZ NOT NULL,
      "dueAt" TIMESTAMPTZ,
      "returnedAt" TIMESTAMPTZ
    )
  `);
  await client.query(`
    CREATE UNIQUE INDEX "Loan_one_active_per_book_test"
    ON "Loan" ("bookId") WHERE "returnedAt" IS NULL
  `);
  await client.query(`
    INSERT INTO "Book"
      (id, "googleBookId", isbn13, title, authors, description, thumbnail, "createdAt") VALUES
      ('book-1', 'g-1', '9780000000001', '本1', ARRAY['著者1'], '説明1', '/1.png', '2026-08-01T00:00:00Z'),
      ('book-2', 'g-2', '9780000000002', '本2', ARRAY['著者2'], '説明2', NULL, '2026-08-02T00:00:00Z'),
      ('book-3', 'g-3', '9780000000003', '本3', ARRAY['著者3'], '説明3', NULL, '2026-08-03T00:00:00Z'),
      ('book-overdue', NULL, '9780000000004', '期限切れ本', ARRAY['著者'], NULL, NULL, '2026-08-04T00:00:00Z'),
      ('book-today-start', NULL, '9780000000005', '今日0時期限本', ARRAY['著者'], NULL, NULL, '2026-08-05T00:00:00Z'),
      ('book-today-end', NULL, '9780000000006', '今日23時59分期限本', ARRAY['著者'], NULL, NULL, '2026-08-06T00:00:00Z'),
      ('book-tomorrow', NULL, '9780000000007', '明日期限本', ARRAY['著者'], NULL, NULL, '2026-08-07T00:00:00Z'),
      ('book-no-due', NULL, '9780000000008', '期限なし本', ARRAY['著者'], NULL, NULL, '2026-08-08T00:00:00Z'),
      ('book-returned', NULL, '9780000000009', '返却済み本', ARRAY['著者'], NULL, NULL, '2026-08-09T00:00:00Z'),
      ('book-other', NULL, '9780000000010', '別ユーザー本', ARRAY['著者'], NULL, NULL, '2026-08-10T00:00:00Z')
  `);
}

describeWithDatabase("返却期限RouteとPostgreSQLの結合", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectIntegrationClient(databaseUrl!);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } } as never);
    mockedQuery.mockImplementation((text, params = []) => client.query(text, params));
    await withTempTableSetup(client, () => createTables(client));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it("JSTの今日をdueToday、今日より前をoverdueへ分けて他を除外する", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T15:30:00.000Z"));
    await client.query(`
      INSERT INTO "Loan" (id, "userEmail", "bookId", "loanedAt", "dueAt", "returnedAt") VALUES
        ('overdue', 'user@example.com', 'book-overdue', '2026-08-01T00:00:00Z', '2026-08-16T14:59:59.999Z', NULL),
        ('today-start', 'user@example.com', 'book-today-start', '2026-08-01T00:00:00Z', '2026-08-16T15:00:00.000Z', NULL),
        ('today-end', 'user@example.com', 'book-today-end', '2026-08-01T00:00:00Z', '2026-08-17T14:59:59.999Z', NULL),
        ('tomorrow', 'user@example.com', 'book-tomorrow', '2026-08-01T00:00:00Z', '2026-08-17T15:00:00.000Z', NULL),
        ('no-due', 'user@example.com', 'book-no-due', '2026-08-01T00:00:00Z', NULL, NULL),
        ('returned', 'user@example.com', 'book-returned', '2026-08-01T00:00:00Z', '2026-08-16T16:00:00Z', '2026-08-16T17:00:00Z'),
        ('other', 'other@example.com', 'book-other', '2026-08-01T00:00:00Z', '2026-08-16T16:00:00Z', NULL)
    `);

    const response = await getBookStatus();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overdue.map((loan: { bookTitle: string }) => loan.bookTitle)).toEqual(["期限切れ本"]);
    expect(body.dueToday.map((loan: { bookTitle: string }) => loan.bookTitle)).toEqual([
      "今日0時期限本",
      "今日23時59分期限本",
    ]);
  });

  it("貸出がなければ返却期限APIが空の結果を返す", async () => {
    const status = await getBookStatus();

    await expect(status.json()).resolves.toEqual({ dueToday: [], overdue: [] });
  });
});
