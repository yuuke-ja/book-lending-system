import { beforeEach, describe, expect, it, vi } from "vitest";
import { createThread } from "@/lib/action/thread";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { summary } from "@/lib/ai/aiSummary";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));
vi.mock("@/lib/ai/aiSummary", () => ({ summary: vi.fn() }));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;
const mockedSummary = summary as unknown as ReturnType<typeof vi.fn>;

const savedThread = {
  id: "thread-1",
  content: "この本どう？",
  bookId: "book-1",
  kind: "BOOK_TOPIC",
  createdAt: "2026-04-03T10:00:00.000Z",
  updatedAt: "2026-04-03T10:00:00.000Z",
};

describe("createThread Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const result = await createThread({
      kind: "BOOK_REQUEST",
      content: "探しています",
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "認証が必要です",
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it.each([
    ["入力本体がない", null, "kindが不正です"],
    [
      "kindが不正",
      { kind: "OTHER", content: "投稿" },
      "kindが不正です",
    ],
    [
      "bookIdが不正",
      { kind: "BOOK_REQUEST", bookId: 1, content: "投稿" },
      "bookIdが不正です",
    ],
    [
      "contentが空",
      { kind: "BOOK_REQUEST", content: "  " },
      "contentが不正です",
    ],
    [
      "BOOK_TOPICにbookIdがない",
      { kind: "BOOK_TOPIC", content: "投稿" },
      "本に紐づく投稿にはbookIdが必要です",
    ],
  ])("%sなら400を返す", async (_caseName, input, error) => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const result = await createThread(input);

    expect(result).toEqual({ ok: false, status: 400, error });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("存在しないbookIdなら404を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const result = await createThread({
      kind: "BOOK_TOPIC",
      bookId: "missing-book",
      content: "この本どう？",
    });

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: "本が見つかりません",
    });
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it("本付きスレッドを保存できる", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "book-1" }] });
    mockedQuery.mockResolvedValueOnce({ rows: [savedThread] });

    const result = await createThread({
      kind: "BOOK_TOPIC",
      bookId: "book-1",
      content: "  この本どう？  ",
    });

    expect(result).toEqual({
      ok: true,
      status: 200,
      message: "投稿を作成しました",
    });
    expect(mockedQuery.mock.calls[1]?.[1]).toEqual([
      "BOOK_TOPIC",
      "book-1",
      "user@example.com",
      "この本どう？",
    ]);
    expect(mockedSummary).not.toHaveBeenCalled();
  });

  it("本なし相談スレッドを保存できる", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    const booklessThread = {
      ...savedThread,
      id: "thread-2",
      bookId: null,
      kind: "BOOK_REQUEST",
      content: "おすすめありますか",
    };
    mockedQuery.mockResolvedValueOnce({ rows: [booklessThread] });

    const result = await createThread({
      kind: "BOOK_REQUEST",
      content: "おすすめありますか",
    });

    expect(result.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedQuery.mock.calls[0]?.[1]).toEqual([
      "BOOK_REQUEST",
      null,
      "user@example.com",
      "おすすめありますか",
    ]);
  });

  it("800文字以上のスレッドなら要約を保存する", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    const longThread = {
      ...savedThread,
      id: "thread-long",
      content: "あ".repeat(800),
    };
    mockedQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "book-1" }] });
    mockedQuery.mockResolvedValueOnce({ rows: [longThread] });

    const result = await createThread({
      kind: "BOOK_TOPIC",
      bookId: "book-1",
      content: "あ".repeat(800),
    });

    expect(result.status).toBe(200);
    expect(mockedSummary).toHaveBeenCalledWith({
      sourceType: "thread",
      sourceId: "thread-long",
      content: "あ".repeat(800),
      updatedAt: savedThread.updatedAt,
    });
  });

  it("DB処理に失敗したとき500を返す", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockRejectedValueOnce(new Error("database error"));

    const result = await createThread({
      kind: "BOOK_REQUEST",
      content: "投稿",
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: "スレッドの作成に失敗しました",
    });
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
