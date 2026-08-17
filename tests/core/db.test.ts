import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const pgState = vi.hoisted(() => {
  const client = {
    query: vi.fn(),
    release: vi.fn(),
  };
  const pool = {
    query: vi.fn(),
    connect: vi.fn(),
    on: vi.fn(),
  };
  const Pool = vi.fn(function MockPool() {
    return pool;
  });

  return { client, pool, Pool };
});

vi.mock("server-only", () => ({}));
vi.mock("pg", () => ({ Pool: pgState.Pool }));

describe("db.transaction", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  let db: typeof import("@/lib/db")["db"];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { __dbPool?: unknown }).__dbPool;
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    pgState.pool.connect.mockResolvedValue(pgState.client);
    pgState.pool.on.mockReturnValue(pgState.pool);
    pgState.client.query.mockResolvedValue({ rows: [], rowCount: 0 });
    db = (await import("@/lib/db")).db;
  });

  afterAll(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    delete (globalThis as typeof globalThis & { __dbPool?: unknown }).__dbPool;
  });

  it("BEGINからCOMMITまで同じclientを使いcallbackの値を返す", async () => {
    const result = await db.transaction(async (tx) => {
      await tx.query("SELECT $1::text", ["value"]);
      return "completed";
    });

    expect(result).toBe("completed");
    expect(pgState.client.query.mock.calls).toEqual([
      ["BEGIN"],
      ["SELECT $1::text", ["value"]],
      ["COMMIT"],
    ]);
    expect(pgState.client.release).toHaveBeenCalledOnce();
  });

  it("transaction clientのparams省略時は空配列を渡す", async () => {
    await db.transaction(async (tx) => {
      await tx.query("SELECT 1");
    });

    expect(pgState.client.query).toHaveBeenNthCalledWith(2, "SELECT 1", []);
  });

  it("callbackが失敗したらROLLBACKして同じ例外を再throwする", async () => {
    const error = new Error("callback failed");

    await expect(
      db.transaction(async () => {
        throw error;
      })
    ).rejects.toBe(error);

    expect(pgState.client.query.mock.calls).toEqual([["BEGIN"], ["ROLLBACK"]]);
    expect(pgState.client.release).toHaveBeenCalledOnce();
  });

  it("COMMITが失敗してもROLLBACKとreleaseを実行する", async () => {
    const error = new Error("commit failed");
    pgState.client.query.mockImplementation(async (sql: string) => {
      if (sql === "COMMIT") throw error;
      return { rows: [], rowCount: 0 };
    });

    await expect(db.transaction(async () => "value")).rejects.toBe(error);
    expect(pgState.client.query.mock.calls).toEqual([
      ["BEGIN"],
      ["COMMIT"],
      ["ROLLBACK"],
    ]);
    expect(pgState.client.release).toHaveBeenCalledOnce();
  });

  it("BEGINが失敗してもROLLBACKを試みてreleaseする", async () => {
    const error = new Error("begin failed");
    pgState.client.query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN") throw error;
      return { rows: [], rowCount: 0 };
    });

    await expect(db.transaction(async () => undefined)).rejects.toBe(error);
    expect(pgState.client.query.mock.calls).toEqual([["BEGIN"], ["ROLLBACK"]]);
    expect(pgState.client.release).toHaveBeenCalledOnce();
  });
});
