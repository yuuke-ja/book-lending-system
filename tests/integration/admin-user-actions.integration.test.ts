import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "pg";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/action/admin/require-admin";
import { rebuildBookEmbeddings } from "@/app/api/admin/book-embeddings/book-embedding";
import { saveLoanSettings } from "@/lib/action/admin/loan-settings";
import { updateBookTags } from "@/lib/action/admin/book-tags";
import { createNotice, deleteNotice } from "@/lib/action/admin/notices";
import { updateUserProfile } from "@/lib/action/user-profile";
import {
  subscribePushNotification,
  unsubscribePushNotification,
} from "@/lib/action/push-notification";
import {
  connectIntegrationClient,
  createDatabaseAdapter,
  dropTempTables,
  getIntegrationDatabaseUrl,
  withTempTableSetup,
} from "./postgres-test-utils";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { query: vi.fn(), transaction: vi.fn() },
}));
vi.mock("@/lib/action/admin/require-admin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/app/api/admin/book-embeddings/book-embedding", () => ({
  rebuildBookEmbeddings: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const databaseUrl = getIntegrationDatabaseUrl();
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const mockedAuth = vi.mocked(auth);
const mockedQuery = vi.mocked(db.query);
const mockedTransaction = vi.mocked(db.transaction);
const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedRebuildBookEmbeddings = vi.mocked(rebuildBookEmbeddings);

async function createTables(client: Client) {
  await dropTempTables(client, [
    "PushSubscription",
    "Notice",
    "BookTag",
    "TagList",
    "User",
    "Book",
    "LoanOpenPeriod",
    "LoanSettings",
  ]);
  await client.query(`
    CREATE TEMP TABLE "LoanSettings" (
      "settingKey" TEXT NOT NULL UNIQUE,
      id TEXT PRIMARY KEY,
      "fridayOnly" BOOLEAN NOT NULL,
      "loanPeriodDays" INTEGER NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "LoanOpenPeriod" (
      id TEXT PRIMARY KEY,
      "loanSettingsId" TEXT NOT NULL,
      "startDate" TIMESTAMPTZ NOT NULL,
      "endDate" TIMESTAMPTZ NOT NULL,
      "loanPeriodDays" INTEGER NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("loanSettingsId") REFERENCES "LoanSettings"(id)
    )
  `);
  await client.query(`CREATE TEMP TABLE "Book" (id TEXT PRIMARY KEY, title TEXT NOT NULL)`);
  await client.query(`CREATE TEMP TABLE "TagList" (id TEXT PRIMARY KEY, tag TEXT NOT NULL)`);
  await client.query(`
    CREATE TEMP TABLE "BookTag" (
      "bookId" TEXT NOT NULL,
      "tagId" TEXT NOT NULL,
      UNIQUE ("bookId", "tagId")
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "Notice" (
      id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
      title TEXT NOT NULL,
      content JSONB NOT NULL,
      "bookId" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "User" (
      email TEXT PRIMARY KEY,
      nickname TEXT,
      avatarurl TEXT
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "PushSubscription" (
      id TEXT PRIMARY KEY,
      "userEmail" TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

describeWithDatabase("管理設定・通知・プロフィールActionとPostgreSQLの結合", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectIntegrationClient(databaseUrl!);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } } as never);
    mockedRequireAdmin.mockResolvedValue({ ok: true });
    mockedRebuildBookEmbeddings.mockResolvedValue(1);
    const adapter = createDatabaseAdapter(client);
    mockedQuery.mockImplementation(adapter.query);
    mockedTransaction.mockImplementation(adapter.transaction);
    await withTempTableSetup(client, async () => {
      await createTables(client);
      await client.query(`INSERT INTO "Book" (id, title) VALUES ('book-1', '本1')`);
      await client.query(`
        INSERT INTO "TagList" (id, tag) VALUES ('tag-1', 'Web'), ('tag-2', 'DB')
      `);
      await client.query(`
        INSERT INTO "User" (email, nickname, avatarurl)
        VALUES ('user@example.com', '変更前', '/old.png')
      `);
    });
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it("貸出設定と重ならない複数例外期間を同じtransactionで保存する", async () => {
    const result = await saveLoanSettings({
      fridayOnly: true,
      returnweek: 2,
      exceptionRules: [
        { startDate: "2026-09-02", endDate: "2026-09-05", loanPeriodDays: 4 },
        { startDate: "2026-09-10", endDate: "2026-09-12", loanPeriodDays: 3 },
      ],
    });

    expect(result).toMatchObject({ ok: true, status: 200 });
    const settings = await client.query(
      `SELECT "settingKey", "fridayOnly", "loanPeriodDays" FROM "LoanSettings"`
    );
    const periods = await client.query<{ startDate: Date; endDate: Date; loanPeriodDays: number }>(
      `SELECT "startDate", "endDate", "loanPeriodDays"
       FROM "LoanOpenPeriod" ORDER BY "startDate"`
    );
    expect(settings.rows).toEqual([
      { settingKey: "default", fridayOnly: true, loanPeriodDays: 2 },
    ]);
    expect(periods.rows).toHaveLength(2);
    expect(periods.rows[0].startDate.toISOString()).toBe("2026-09-01T15:00:00.000Z");
    expect(periods.rows[0].endDate.toISOString()).toBe("2026-09-05T14:59:59.999Z");
  });

  it.each([
    [
      "存在しない日付",
      [{ startDate: "2026-02-31", endDate: "2026-03-10", loanPeriodDays: 2 }],
    ],
    [
      "重複期間",
      [
        { startDate: "2026-09-01", endDate: "2026-09-10", loanPeriodDays: 2 },
        { startDate: "2026-09-10", endDate: "2026-09-20", loanPeriodDays: 2 },
      ],
    ],
  ])("%sの例外設定を400で拒否しDBへ保存しない", async (_name, exceptionRules) => {
    const result = await saveLoanSettings({
      fridayOnly: true,
      returnweek: 2,
      exceptionRules,
    });

    expect(result).toMatchObject({ ok: false, status: 400 });
    const settings = await client.query(`SELECT id FROM "LoanSettings"`);
    expect(settings.rows).toEqual([]);
  });

  it("過去の例外期間は履歴として保存できる", async () => {
    const result = await saveLoanSettings({
      fridayOnly: true,
      returnweek: 2,
      exceptionRules: [
        { startDate: "2026-01-01", endDate: "2026-01-02", loanPeriodDays: 2 },
      ],
    });

    expect(result).toMatchObject({ ok: true, status: 200 });
    const periods = await client.query<{ startDate: Date; endDate: Date }>(
      `SELECT "startDate", "endDate" FROM "LoanOpenPeriod"`
    );
    expect(periods.rows[0].startDate.toISOString()).toBe("2025-12-31T15:00:00.000Z");
    expect(periods.rows[0].endDate.toISOString()).toBe("2026-01-02T14:59:59.999Z");
  });

  it("書籍ジャンルを重複除外して置き換え、Embedding再作成へ対象本を渡す", async () => {
    await client.query(`INSERT INTO "BookTag" ("bookId", "tagId") VALUES ('book-1', 'tag-1')`);

    const result = await updateBookTags({
      bookId: "book-1",
      tags: ["tag-2", "tag-2", "missing-tag"],
    });

    expect(result).toMatchObject({ ok: true, data: { embeddingCount: 1 } });
    const tags = await client.query(`SELECT "tagId" FROM "BookTag" ORDER BY "tagId"`);
    expect(tags.rows).toEqual([{ tagId: "tag-2" }]);
    expect(mockedRebuildBookEmbeddings).toHaveBeenCalledWith(["book-1"]);
  });

  it("本付きお知らせを保存して削除する", async () => {
    const created = await createNotice({
      title: "  お知らせ  ",
      content: { type: "doc", content: [] },
      bookId: "book-1",
    });

    expect(created).toMatchObject({ ok: true, status: 201 });
    const notices = await client.query<{ id: string; title: string; bookId: string }>(
      `SELECT id, title, "bookId" FROM "Notice"`
    );
    expect(notices.rows[0]).toMatchObject({ title: "お知らせ", bookId: "book-1" });

    await expect(deleteNotice(notices.rows[0].id)).resolves.toMatchObject({
      ok: true,
      status: 200,
    });
    const remaining = await client.query(`SELECT id FROM "Notice"`);
    expect(remaining.rows).toEqual([]);
  });

  it("プロフィールのニックネームと画像URLを同じ利用者へ保存する", async () => {
    await expect(
      updateUserProfile({ nickname: "変更後", avatarUrl: "/new.png" })
    ).resolves.toMatchObject({ ok: true, status: 200 });

    const user = await client.query(
      `SELECT nickname, avatarurl FROM "User" WHERE email = 'user@example.com'`
    );
    expect(user.rows).toEqual([{ nickname: "変更後", avatarurl: "/new.png" }]);
  });

  it("Push購読をendpoint単位で更新し、同じ利用者だけ解除する", async () => {
    await subscribePushNotification({
      endpoint: "https://push.example/subscription",
      keys: { p256dh: "key-1", auth: "auth-1" },
    });
    await subscribePushNotification({
      endpoint: "https://push.example/subscription",
      keys: { p256dh: "key-2", auth: "auth-2" },
    });

    const subscriptions = await client.query(
      `SELECT "userEmail", endpoint, p256dh, auth FROM "PushSubscription"`
    );
    expect(subscriptions.rows).toEqual([
      {
        userEmail: "user@example.com",
        endpoint: "https://push.example/subscription",
        p256dh: "key-2",
        auth: "auth-2",
      },
    ]);

    await unsubscribePushNotification("https://push.example/subscription");
    const remaining = await client.query(`SELECT id FROM "PushSubscription"`);
    expect(remaining.rows).toEqual([]);
  });
});
