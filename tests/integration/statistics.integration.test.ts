import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "pg";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";
import { GET as getMonthStatistics } from "@/app/api/statistics/month/route";
import { GET as getWeekStatistics } from "@/app/api/statistics/week/route";
import { GET as getSummary } from "@/app/api/statistics/summary/route";
import {
  connectIntegrationClient,
  dropTempTables,
  getIntegrationDatabaseUrl,
  withTempTableSetup,
} from "./postgres-test-utils";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/admin", () => ({ Admin: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));

const databaseUrl = getIntegrationDatabaseUrl();
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const mockedAuth = vi.mocked(auth);
const mockedAdmin = vi.mocked(Admin);
const mockedQuery = vi.mocked(db.query);

describeWithDatabase("月次・週次・サマリー統計とPostgreSQLの結合", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectIntegrationClient(databaseUrl!);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } } as never);
    mockedAdmin.mockResolvedValue(true);
    mockedQuery.mockImplementation((text, params = []) => client.query(text, params));
    await withTempTableSetup(client, async () => {
      await dropTempTables(client, ["Loan", "Book"]);
      await client.query(`CREATE TEMP TABLE "Book" (id TEXT PRIMARY KEY)`);
      await client.query(`
        CREATE TEMP TABLE "Loan" (
          id TEXT PRIMARY KEY,
          "userEmail" TEXT NOT NULL,
          "bookId" TEXT NOT NULL,
          "loanedAt" TIMESTAMPTZ NOT NULL,
          "returnedAt" TIMESTAMPTZ,
          FOREIGN KEY ("bookId") REFERENCES "Book"(id)
        )
      `);
      await client.query(`
        CREATE UNIQUE INDEX "Loan_one_active_per_book"
        ON "Loan" ("bookId") WHERE "returnedAt" IS NULL
      `);
      await client.query(`INSERT INTO "Book" (id) VALUES ('book-1'), ('book-2'), ('book-3')`);
    });
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it("指定月までの6か月を0件の月も含めて月別集計する", async () => {
    await client.query(`
      INSERT INTO "Loan" (id, "userEmail", "bookId", "loanedAt", "returnedAt") VALUES
        ('march-1', 'one@example.com', 'book-1', '2026-03-01T00:00:00Z', '2026-03-10T00:00:00Z'),
        ('august-1', 'one@example.com', 'book-1', '2026-08-01T00:00:00Z', NULL),
        ('august-2', 'two@example.com', 'book-2', '2026-08-02T00:00:00Z', NULL)
    `);

    const response = await getMonthStatistics(
      new Request("http://localhost/api/statistics/month?anchorDate=2026-08-16")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(6);
    expect(body.map((row: { loanCount: number }) => row.loanCount)).toEqual([1, 0, 0, 0, 0, 2]);
    expect(body.at(-1)).toMatchObject({ loanCount: 2, userCount: 2 });
  });

  it("指定日を含む週までの6週間を月曜区切りで集計する", async () => {
    await client.query(`
      INSERT INTO "Loan" (id, "userEmail", "bookId", "loanedAt") VALUES
        ('week-start', 'one@example.com', 'book-1', '2026-08-10T00:00:00Z'),
        ('week-middle', 'two@example.com', 'book-2', '2026-08-16T14:59:59Z'),
        ('previous-week', 'one@example.com', 'book-3', '2026-08-09T14:59:59Z')
    `);

    const response = await getWeekStatistics(
      new Request("http://localhost/api/statistics/week?anchorDate=2026-08-16")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(6);
    expect(body.at(-1)).toMatchObject({ loanCount: 2, userCount: 2 });
    expect(body.at(-2)).toMatchObject({ loanCount: 1, userCount: 1 });
  });

  it("今週・今月・貸出中・蔵書数を数値で返す", async () => {
    await client.query(`
      INSERT INTO "Loan" (id, "userEmail", "bookId", "loanedAt", "returnedAt") VALUES
        ('this-week-active', 'one@example.com', 'book-1', now(), NULL),
        ('this-week-returned', 'two@example.com', 'book-2', now(), now()),
        ('old-active', 'old@example.com', 'book-3', date_trunc('month', now()) - interval '1 month', NULL)
    `);

    const response = await getSummary();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      thisWeekLoanCount: 2,
      thisWeekUserCount: 2,
      thisMonthLoanCount: 2,
      thisMonthUserCount: 2,
      activeLoanCount: 2,
      bookCount: 3,
    });
    expect(Object.values(body).every((value) => typeof value === "number")).toBe(true);
  });

  it("存在しない暦日を400で拒否しDB集計を実行しない", async () => {
    vi.clearAllMocks();
    const response = await getMonthStatistics(
      new Request("http://localhost/api/statistics/month?anchorDate=2026-02-31")
    );

    expect(response.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
