import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { returnBook } from "@/lib/action/return";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

describe("returnBook Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const result = await returnBook("book-1");

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "認証が必要です",
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("bookIdが不正なとき400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const result = await returnBook(null);

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "bookIdが不正です",
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("返却対象の貸出が見つからないとき404を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValue({ rowCount: 0 });

    const result = await returnBook("book-1");

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: "返却する貸出が見つかりません",
    });
  });

  it("返却に成功したとき200を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValue({ rowCount: 1 });

    const result = await returnBook("book-1");

    expect(result).toEqual({
      ok: true,
      status: 200,
      message: "返却が完了しました",
    });
    expect(mockedRevalidatePath.mock.calls).toEqual([
      ["/"],
      ["/book-list"],
    ]);
  });

  it("DB処理に失敗したとき500を返す", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockRejectedValue(new Error("database error"));

    const result = await returnBook("book-1");

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: "返却に失敗しました",
    });
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
