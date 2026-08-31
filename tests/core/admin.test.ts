import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: { query: vi.fn() },
}));

const mockedQuery = vi.mocked(db.query);

describe("Admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_EMAIL_DOMAIN", "admins.example.test");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it.each([undefined, ""])("emailが %s ならfalseを返す", async (email) => {
    await expect(Admin(email)).resolves.toBe(false);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it.each(["teacher@admins.example.test", "TEACHER@ADMINS.EXAMPLE.TEST"])(
    "%s はDB参照なしで管理者と判定する",
    async (email) => {
      await expect(Admin(email)).resolves.toBe(true);
      expect(mockedQuery).not.toHaveBeenCalled();
    }
  );

  it("Adminテーブルに登録済みならtrueを返す", async () => {
    mockedQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ email: "admin@users.example.test" }],
    } as never);

    await expect(Admin("admin@users.example.test")).resolves.toBe(true);
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM "Admin" WHERE email = $1'),
      ["admin@users.example.test"]
    );
  });

  it.each([0, null, undefined])(
    "AdminテーブルのrowCountが %s ならfalseを返す",
    async (rowCount) => {
      mockedQuery.mockResolvedValueOnce({ rowCount, rows: [] } as never);
      await expect(Admin("user@users.example.test")).resolves.toBe(false);
    }
  );

  it("DB例外時はログを残してfalseへ安全側に倒す", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("database unavailable");
    mockedQuery.mockRejectedValueOnce(error);

    await expect(Admin("user@users.example.test")).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalledWith("管理者判定に失敗:", error);

    consoleError.mockRestore();
  });
});
