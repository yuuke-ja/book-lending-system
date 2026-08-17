import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "pg";
import { db } from "@/lib/db";
import { POST } from "@/app/api/admin/sync-admins/route";
import {
  connectIntegrationClient,
  createDatabaseAdapter,
  dropTempTables,
  getIntegrationDatabaseUrl,
  withTempTableSetup,
} from "./postgres-test-utils";

vi.mock("@/lib/db", () => ({
  db: { query: vi.fn(), transaction: vi.fn() },
}));

const databaseUrl = getIntegrationDatabaseUrl();
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const mockedTransaction = vi.mocked(db.transaction);

function syncRequest(emails: unknown) {
  return new Request("http://localhost/api/admin/sync-admins", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-sync-secret": "integration-secret",
    },
    body: JSON.stringify({ emails }),
  });
}

describeWithDatabase("管理者同期RouteとPostgreSQL transactionの結合", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectIntegrationClient(databaseUrl!);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SYNC_SECRET", "integration-secret");
    const adapter = createDatabaseAdapter(client);
    mockedTransaction.mockImplementation(adapter.transaction);

    await withTempTableSetup(client, async () => {
      await dropTempTables(client, ["Admin"]);
      await client.query(`
        CREATE TEMP TABLE "Admin" (
          email TEXT PRIMARY KEY,
          CONSTRAINT "Admin_reject_failure_fixture"
            CHECK (email <> 'fail@example.com')
        )
      `);
      await client.query(
        `INSERT INTO "Admin" (email) VALUES ('old-admin@example.com')`
      );
    });
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    if (client) await client.end();
  });

  it("既存管理者を削除し、重複を除いた新しい管理者へ置き換える", async () => {
    const response = await POST(
      syncRequest([
        "new-admin@example.com",
        "new-admin@example.com",
        "staff@example.com",
      ])
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, count: 3 });
    const admins = await client.query<{ email: string }>(
      `SELECT email FROM "Admin" ORDER BY email`
    );
    expect(admins.rows).toEqual([
      { email: "new-admin@example.com" },
      { email: "staff@example.com" },
    ]);
  });

  it("空配列なら既存管理者の削除だけをcommitする", async () => {
    const response = await POST(syncRequest([]));

    expect(response.status).toBe(200);
    const admins = await client.query(`SELECT email FROM "Admin"`);
    expect(admins.rows).toEqual([]);
  });

  it("INSERTが失敗したら先行したDELETEもrollbackする", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(syncRequest(["fail@example.com"]));

    expect(response.status).toBe(500);
    const admins = await client.query<{ email: string }>(
      `SELECT email FROM "Admin"`
    );
    expect(admins.rows).toEqual([{ email: "old-admin@example.com" }]);
  });
});
