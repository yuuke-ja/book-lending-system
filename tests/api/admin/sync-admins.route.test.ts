import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/sync-admins/route";
import { POST as aliasPost } from "@/app/api/sync-admins/route";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({ db: { transaction: vi.fn() } }));

const mockedTransaction = vi.mocked(db.transaction);

function request(body: string, secret?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (secret !== undefined) headers.set("x-admin-sync-secret", secret);
  return new Request("http://localhost/api/admin/sync-admins", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/admin/sync-admins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SYNC_SECRET", "sync-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([undefined, "wrong-secret"])("secretが一致しなければ401", async (secret) => {
    const response = await POST(request(JSON.stringify({ emails: [] }), secret));

    expect(response.status).toBe(401);
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it("環境変数がなければ認証を通さない", async () => {
    vi.stubEnv("ADMIN_SYNC_SECRET", "");

    const response = await POST(request(JSON.stringify({ emails: [] }), "sync-secret"));

    expect(response.status).toBe(401);
  });

  it.each([
    ["壊れたJSON", "{"],
    ["emailsなし", JSON.stringify({})],
    ["emailsが配列でない", JSON.stringify({ emails: "admin@example.com" })],
    ["要素が文字列でない", JSON.stringify({ emails: [123] })],
  ])("%sなら400", async (_name, body) => {
    const response = await POST(request(body, "sync-secret"));

    expect(response.status).toBe(400);
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it("空配列ならtransaction内でAdminを削除するだけ", async () => {
    const txQuery = vi.fn().mockResolvedValue({ rows: [] });
    mockedTransaction.mockImplementationOnce(async (callback) =>
      callback({ query: txQuery } as never)
    );

    const response = await POST(request(JSON.stringify({ emails: [] }), "sync-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, count: 0 });
    expect(txQuery).toHaveBeenCalledTimes(1);
    expect(String(txQuery.mock.calls[0][0])).toContain('DELETE FROM "Admin"');
  });

  it("Adminを削除して渡されたメールを重複排除INSERTする", async () => {
    const emails = ["admin@example.com", "admin@example.com", "staff@example.com"];
    const txQuery = vi.fn().mockResolvedValue({ rows: [] });
    mockedTransaction.mockImplementationOnce(async (callback) =>
      callback({ query: txQuery } as never)
    );

    const response = await POST(request(JSON.stringify({ emails }), "sync-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, count: 3 });
    expect(txQuery).toHaveBeenCalledTimes(2);
    expect(String(txQuery.mock.calls[1][0])).toContain("SELECT DISTINCT");
    expect(txQuery.mock.calls[1][1]).toEqual([emails]);
  });

  it("transaction失敗なら500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedTransaction.mockRejectedValueOnce(new Error("database error"));

    const response = await POST(request(JSON.stringify({ emails: [] }), "sync-secret"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Internal Server Error",
    });
  });

  it("公開aliasは同じhandlerを再exportする", () => {
    expect(aliasPost).toBe(POST);
  });
});
