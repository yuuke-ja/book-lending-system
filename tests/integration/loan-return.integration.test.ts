import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "pg";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { loanBook } from "@/lib/action/loan";
import { returnBook } from "@/lib/action/return";
import {
  connectIntegrationClient,
  createDatabaseAdapter,
  dropTempTables,
  getIntegrationDatabaseUrl,
  withTempTableSetup,
} from "./postgres-test-utils";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { query: vi.fn(), transaction: vi.fn() },
}));

const databaseUrl = getIntegrationDatabaseUrl();
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const mockedAuth = vi.mocked(auth);
const mockedQuery = vi.mocked(db.query);
const mockedTransaction = vi.mocked(db.transaction);

async function createLoanTables(client: Client) {
  await dropTempTables(client, [
    "ResearchEvent",
    "Loan",
    "LoanOpenPeriod",
    "LoanSettings",
    "Book",
  ]);
  await client.query(`
    CREATE TEMP TABLE "Book" (
      id TEXT PRIMARY KEY
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "LoanSettings" (
      id TEXT PRIMARY KEY,
      "loanEnabled" BOOLEAN NOT NULL DEFAULT true,
      "fridayOnly" BOOLEAN NOT NULL,
      "loanPeriodDays" INTEGER NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "LoanOpenPeriod" (
      id TEXT PRIMARY KEY,
      "loanSettingsId" TEXT NOT NULL,
      "loanPeriodDays" INTEGER NOT NULL,
      "startDate" TIMESTAMPTZ NOT NULL,
      "endDate" TIMESTAMPTZ NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      FOREIGN KEY ("loanSettingsId") REFERENCES "LoanSettings"(id)
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "Loan" (
      id TEXT PRIMARY KEY,
      "userEmail" TEXT NOT NULL,
      "bookId" TEXT NOT NULL,
      "loanedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "dueAt" TIMESTAMPTZ,
      "returnedAt" TIMESTAMPTZ,
      FOREIGN KEY ("bookId") REFERENCES "Book"(id)
    )
  `);
  await client.query(`
    CREATE UNIQUE INDEX "Loan_one_active_per_book"
    ON "Loan" ("bookId") WHERE "returnedAt" IS NULL
  `);
  await client.query(`
    CREATE TEMP TABLE "ResearchEvent" (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      "eventType" TEXT NOT NULL,
      "userEmail" TEXT NOT NULL,
      "bookId" TEXT NOT NULL,
      "sourceType" TEXT NOT NULL,
      "sourceId" TEXT,
      "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

describeWithDatabase("貸出・返却とPostgreSQLの結合", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectIntegrationClient(databaseUrl!);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({
      user: { email: "user@example.com" },
    } as never);
    const adapter = createDatabaseAdapter(client);
    mockedQuery.mockImplementation(adapter.query);
    mockedTransaction.mockImplementation(adapter.transaction);
    await withTempTableSetup(client, async () => {
      await createLoanTables(client);
      await client.query(
        `INSERT INTO "LoanSettings" (id, "fridayOnly", "loanPeriodDays")
         VALUES ('settings', false, 2)`
      );
      await client.query(
        `INSERT INTO "Book" (id) VALUES ('book-1'), ('book-2')`
      );
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it("貸出ActionがLoanとResearchEventを同じtransactionで保存する", async () => {
    const result = await loanBook("book-1");

    expect(result).toMatchObject({ ok: true, status: 200 });
    const loan = await client.query(
      `SELECT "userEmail", "bookId", "dueAt", "returnedAt" FROM "Loan"`
    );
    expect(loan.rows).toHaveLength(1);
    expect(loan.rows[0]).toMatchObject({
      userEmail: "user@example.com",
      bookId: "book-1",
      returnedAt: null,
    });
    const event = await client.query(
      `SELECT "eventType", "userEmail", "bookId", "sourceType" FROM "ResearchEvent"`
    );
    expect(event.rows).toEqual([
      {
        eventType: "loan",
        userEmail: "user@example.com",
        bookId: "book-1",
        sourceType: "direct",
      },
    ]);
  });

  it("同じ本を続けて貸し出すと409になりLoanを増やさない", async () => {
    await expect(loanBook("book-1")).resolves.toMatchObject({ ok: true });

    await expect(loanBook("book-1")).resolves.toMatchObject({
      ok: false,
      status: 409,
    });
    const count = await client.query(`SELECT COUNT(*)::int AS count FROM "Loan"`);
    expect(count.rows[0].count).toBe(1);
  });

  it("イベント保存が失敗したら先にINSERTしたLoanもrollbackする", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await withTempTableSetup(client, () =>
      client.query(`
        ALTER TABLE pg_temp."ResearchEvent"
        ADD CONSTRAINT "reject_loan_event_fixture"
        CHECK ("eventType" <> 'loan')
      `)
    );

    await expect(loanBook("book-1")).resolves.toMatchObject({
      ok: false,
      status: 500,
    });
    const count = await client.query(`SELECT COUNT(*)::int AS count FROM "Loan"`);
    expect(count.rows[0].count).toBe(0);
  });

  it("UTC実行でもJST金曜深夜の返却期限を指定曜日の23:59にする", async () => {
    vi.stubEnv("TZ", "UTC");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T15:30:00.000Z"));

    await expect(loanBook("book-1")).resolves.toMatchObject({ ok: true });
    const loan = await client.query<{ dueAt: Date }>(
      `SELECT "dueAt" FROM "Loan" WHERE "bookId" = 'book-1'`
    );
    expect(loan.rows[0].dueAt.toISOString()).toBe(
      "2026-03-10T14:59:59.999Z"
    );
  });

  it("例外期間中は金曜以外でも貸し出し、期限を例外終了時刻にする", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T03:00:00.000Z"));
    await client.query(`UPDATE "LoanSettings" SET "fridayOnly" = true`);
    await client.query(
      `INSERT INTO "LoanOpenPeriod"
         (id, "loanSettingsId", "loanPeriodDays", "startDate", "endDate", enabled)
       VALUES
         ('period', 'settings', 10, '2026-08-16T15:00:00.000Z',
          '2026-08-31T14:59:59.999Z', true)`
    );

    await expect(loanBook("book-1")).resolves.toMatchObject({ ok: true });
    const loan = await client.query<{ dueAt: Date }>(
      `SELECT "dueAt" FROM "Loan" WHERE "bookId" = 'book-1'`
    );
    expect(loan.rows[0].dueAt.toISOString()).toBe(
      "2026-08-31T14:59:59.999Z"
    );
  });

  it("金曜限定設定で例外期間外の曜日なら403で保存しない", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T03:00:00.000Z"));
    await client.query(`UPDATE "LoanSettings" SET "fridayOnly" = true`);

    await expect(loanBook("book-1")).resolves.toMatchObject({
      ok: false,
      status: 403,
    });
    const count = await client.query(`SELECT COUNT(*)::int AS count FROM "Loan"`);
    expect(count.rows[0].count).toBe(0);
  });

  it("設定がない場合は金曜限定・火曜返却を既定値として使う", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T03:00:00.000Z"));
    await client.query(`DELETE FROM "LoanSettings"`);

    await expect(loanBook("book-1")).resolves.toMatchObject({ ok: true });
    const loan = await client.query<{ dueAt: Date }>(
      `SELECT "dueAt" FROM "Loan" WHERE "bookId" = 'book-1'`
    );
    expect(loan.rows[0].dueAt.toISOString()).toBe("2026-08-25T14:59:59.999Z");
  });

  it("存在しない本は404で貸出も行動ログも保存しない", async () => {
    await expect(loanBook("missing-book")).resolves.toMatchObject({
      ok: false,
      status: 404,
    });
    const loans = await client.query(`SELECT id FROM "Loan"`);
    const events = await client.query(`SELECT id FROM "ResearchEvent"`);
    expect(loans.rows).toEqual([]);
    expect(events.rows).toEqual([]);
  });

  it("返却Actionは指定した本についてログインユーザーの未返却Loanだけを更新する", async () => {
    await client.query(
      `INSERT INTO "Loan" (id, "userEmail", "bookId", "dueAt") VALUES
         ('mine', 'user@example.com', 'book-1', CURRENT_TIMESTAMP),
         ('other', 'other@example.com', 'book-2', CURRENT_TIMESTAMP)`
    );

    await expect(returnBook("book-1")).resolves.toMatchObject({
      ok: true,
      status: 200,
    });
    const loans = await client.query(
      `SELECT id, "returnedAt" FROM "Loan" ORDER BY id`
    );
    expect(loans.rows[0]).toMatchObject({ id: "mine" });
    expect(loans.rows[0].returnedAt).toBeInstanceOf(Date);
    expect(loans.rows[1]).toEqual({ id: "other", returnedAt: null });
  });

  it("対象となる未返却Loanがなければ404を返す", async () => {
    await expect(returnBook("book-1")).resolves.toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("返却済みの貸出しかない場合は再返却せず404を返す", async () => {
    await client.query(
      `INSERT INTO "Loan" (id, "userEmail", "bookId", "dueAt", "returnedAt")
       VALUES ('returned', 'user@example.com', 'book-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    );

    await expect(returnBook("book-1")).resolves.toMatchObject({
      ok: false,
      status: 404,
    });
  });
});
