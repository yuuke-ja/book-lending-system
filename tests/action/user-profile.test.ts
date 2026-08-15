import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateUserProfile } from "@/lib/action/user-profile";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

describe("updateUserProfile Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const result = await updateUserProfile({ nickname: "テスト" });

    expect(result.status).toBe(401);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("更新項目がないとき400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const result = await updateUserProfile({});

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "更新項目がありません",
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("nicknameが文字列でないとき400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const result = await updateUserProfile({ nickname: 123 });

    expect(result.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("ニックネームだけを更新できる", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValue({ rowCount: 1 });

    const result = await updateUserProfile({ nickname: "テスト" });

    expect(result.status).toBe(200);
    expect(mockedQuery.mock.calls[0]?.[1]).toEqual([
      "テスト",
      "user@example.com",
    ]);
  });

  it("ニックネームとアバターを更新できる", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValue({ rowCount: 1 });

    const result = await updateUserProfile({
      nickname: "テスト",
      avatarUrl: "https://example.com/avatar.png",
    });

    expect(result).toEqual({
      ok: true,
      status: 200,
      message: "プロフィールが更新されました",
    });
    expect(mockedQuery.mock.calls[0]?.[1]).toEqual([
      "テスト",
      "https://example.com/avatar.png",
      "user@example.com",
    ]);
  });

  it("DB処理に失敗したとき500を返す", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockRejectedValue(new Error("database error"));

    const result = await updateUserProfile({ nickname: "テスト" });

    expect(result.status).toBe(500);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
