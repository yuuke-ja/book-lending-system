import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "pg";
import webpush from "web-push";
import { db } from "@/lib/db";
import { notifications } from "@/lib/notification";
import {
  connectIntegrationClient,
  dropTempTables,
  getIntegrationDatabaseUrl,
  withTempTableSetup,
} from "./postgres-test-utils";

vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));

const databaseUrl = getIntegrationDatabaseUrl();
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const mockedQuery = vi.mocked(db.query);
const mockedSendNotification = vi.mocked(webpush.sendNotification);

describeWithDatabase("日次Push通知・期限貸出・購読DBの結合", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectIntegrationClient(databaseUrl!);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "private-key");
    mockedQuery.mockImplementation((text, params = []) => client.query(text, params));
    mockedSendNotification.mockResolvedValue({} as never);
    await withTempTableSetup(client, async () => {
      await dropTempTables(client, ["PushSubscription", "Loan", "Book"]);
      await client.query(`CREATE TEMP TABLE "Book" (id TEXT PRIMARY KEY)`);
      await client.query(`
        CREATE TEMP TABLE "Loan" (
          id TEXT PRIMARY KEY,
          "userEmail" TEXT NOT NULL,
          "bookId" TEXT NOT NULL,
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
        CREATE TEMP TABLE "PushSubscription" (
          id TEXT PRIMARY KEY,
          "userEmail" TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL
        )
      `);
      await client.query(`
        INSERT INTO "Book" (id) VALUES
          ('book-today-1'), ('book-today-2'), ('book-overdue'), ('book-tomorrow'),
          ('book-returned'), ('book-other')
      `);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it("JST当日期限の未返却冊数だけを対象ユーザーの全端末へ送る", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T15:30:00.000Z"));
    await client.query(`
      INSERT INTO "Loan" (id, "userEmail", "bookId", "dueAt", "returnedAt") VALUES
        ('today-1', 'user@example.com', 'book-today-1', '2026-08-16T15:00:00.000Z', NULL),
        ('today-2', 'user@example.com', 'book-today-2', '2026-08-17T14:59:59.999Z', NULL),
        ('overdue', 'user@example.com', 'book-overdue', '2026-08-16T14:59:59.999Z', NULL),
        ('tomorrow', 'user@example.com', 'book-tomorrow', '2026-08-17T15:00:00.000Z', NULL),
        ('returned', 'user@example.com', 'book-returned', '2026-08-16T16:00:00.000Z', now()),
        ('other-user', 'other@example.com', 'book-other', '2026-08-16T16:00:00.000Z', NULL)
    `);
    await client.query(`
      INSERT INTO "PushSubscription" (id, "userEmail", endpoint, p256dh, auth) VALUES
        ('sub-1', 'user@example.com', 'https://push.example/1', 'p1', 'a1'),
        ('sub-2', 'user@example.com', 'https://push.example/2', 'p2', 'a2'),
        ('sub-other', 'nontarget@example.com', 'https://push.example/other', 'po', 'ao')
    `);

    await expect(notifications()).resolves.toEqual({
      targetedUsers: 2,
      subscriptions: 2,
      sent: 2,
      failed: 0,
      removed: 0,
    });
    expect(mockedSendNotification).toHaveBeenCalledTimes(2);
    expect(mockedSendNotification.mock.calls[0][1]).toContain(
      "今日返す本が2件あります。"
    );
  });

  it("404・410の購読だけ実DBから削除し500の購読は残す", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T15:30:00.000Z"));
    await client.query(`
      INSERT INTO "Loan" (id, "userEmail", "bookId", "dueAt", "returnedAt")
      VALUES ('today', 'user@example.com', 'book-today-1', '2026-08-16T16:00:00.000Z', NULL)
    `);
    await client.query(`
      INSERT INTO "PushSubscription" (id, "userEmail", endpoint, p256dh, auth) VALUES
        ('gone-404', 'user@example.com', 'https://push.example/404', 'p1', 'a1'),
        ('gone-410', 'user@example.com', 'https://push.example/410', 'p2', 'a2'),
        ('keep-500', 'user@example.com', 'https://push.example/500', 'p3', 'a3')
    `);
    mockedSendNotification
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockRejectedValueOnce({ statusCode: 500 });

    await expect(notifications()).resolves.toMatchObject({
      sent: 0,
      failed: 3,
      removed: 2,
    });
    const remaining = await client.query(`SELECT id FROM "PushSubscription" ORDER BY id`);
    expect(remaining.rows).toEqual([{ id: "keep-500" }]);
  });
});
