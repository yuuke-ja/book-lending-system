import { beforeEach, describe, expect, it, vi } from "vitest";
import { createComment, deleteComment } from "@/lib/action/comment";
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
const mockedTransaction = db.transaction as unknown as ReturnType<typeof vi.fn>;
const mockedSummary = summary as unknown as ReturnType<typeof vi.fn>;

describe("createComment Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const result = await createComment({
      threadId: "thread-1",
      content: "コメントです",
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "認証が必要です",
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it.each([
    ["入力本体がない", null, "threadIdが不正です"],
    ["threadIdが空", { threadId: "", content: "コメント" }, "threadIdが不正です"],
    [
      "parentCommentIdが空",
      { threadId: "thread-1", parentCommentId: "", content: "コメント" },
      "parentCommentIdが不正です",
    ],
    ["contentが空", { threadId: "thread-1", content: " " }, "contentが不正です"],
    [
      "bookIdsが不正",
      { threadId: "thread-1", content: "コメント", bookIds: [""] },
      "bookIdsが不正です",
    ],
  ])("%sなら400を返す", async (_caseName, input, error) => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const result = await createComment(input);

    expect(result).toEqual({ ok: false, status: 400, error });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("存在しないスレッドなら404を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const result = await createComment({
      threadId: "missing-thread",
      content: "コメントです",
    });

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: "スレッドが見つかりません",
    });
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it("通常コメントを保存できる", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "thread-1" }] });
    const txQuery = vi.fn().mockResolvedValueOnce({
      rows: [{ id: "comment-1", updatedAt: "2026-04-03T10:00:00.000Z" }],
    });
    mockedTransaction.mockImplementation(async (callback) =>
      callback({ query: txQuery })
    );

    const result = await createComment({
      threadId: "thread-1",
      content: "  コメントです  ",
    });

    expect(result).toEqual({
      ok: true,
      status: 200,
      message: "コメントを投稿しました",
    });
    expect(txQuery.mock.calls[0]?.[1]).toEqual([
      "thread-1",
      null,
      "user@example.com",
      "コメントです",
    ]);
    expect(mockedSummary).not.toHaveBeenCalled();
  });

  it("返信を本リンク付きで保存できる", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "thread-1" }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "comment-parent", threadId: "thread-1" }],
      })
      .mockResolvedValueOnce({
        rowCount: 2,
        rows: [{ id: "book-1" }, { id: "book-2" }],
      });
    const txQuery = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ id: "comment-reply-1", updatedAt: "2026-04-03T10:00:00.000Z" }],
      })
      .mockResolvedValueOnce({ rows: [] });
    mockedTransaction.mockImplementation(async (callback) =>
      callback({ query: txQuery })
    );

    const result = await createComment({
      threadId: "thread-1",
      parentCommentId: "comment-parent",
      content: "返信です",
      bookIds: ["book-1", "book-2", "book-1"],
    });

    expect(result.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(3);
    expect(txQuery.mock.calls[0]?.[1]).toEqual([
      "thread-1",
      "comment-parent",
      "user@example.com",
      "返信です",
    ]);
    expect(txQuery.mock.calls[1]?.[1]).toEqual([
      "comment-reply-1",
      ["book-1", "book-2"],
    ]);
  });

  it("500文字以上のコメントなら要約を保存する", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "thread-1" }] });
    const txQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          id: "comment-long",
          updatedAt: "2026-04-03T10:00:00.000Z",
        },
      ],
    });
    mockedTransaction.mockImplementation(async (callback) =>
      callback({ query: txQuery })
    );

    const result = await createComment({
      threadId: "thread-1",
      content: "あ".repeat(500),
    });

    expect(result.status).toBe(200);
    expect(mockedSummary).toHaveBeenCalledWith({
      sourceType: "comment",
      sourceId: "comment-long",
      content: "あ".repeat(500),
      updatedAt: "2026-04-03T10:00:00.000Z",
    });
  });

  it("親コメントのthreadIdが一致しないとき400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "thread-1" }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "comment-parent", threadId: "thread-other" }],
      });

    const result = await createComment({
      threadId: "thread-1",
      parentCommentId: "comment-parent",
      content: "返信です",
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "親コメントのthreadIdが一致しません",
    });
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it("DB処理に失敗したとき500を返す", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockRejectedValueOnce(new Error("database error"));

    const result = await createComment({
      threadId: "thread-1",
      content: "コメントです",
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: "コメントの作成に失敗しました",
    });
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});

describe("deleteComment Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインでは削除しない", async () => {
    mockedAuth.mockResolvedValue(null);

    await expect(deleteComment("comment-1")).resolves.toEqual({
      ok: false,
      status: 401,
      error: "認証が必要です",
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("本人のメールと未削除条件を使ってソフトデリートする", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "comment-1" }] });

    await expect(deleteComment("comment-1")).resolves.toEqual({
      ok: true,
      status: 200,
      message: "コメントを削除しました",
    });
    expect(String(mockedQuery.mock.calls[0]?.[0])).toContain(
      'SET "deletedAt" = NOW()'
    );
    expect(String(mockedQuery.mock.calls[0]?.[0])).toContain(
      'AND "userEmail" = $2'
    );
    expect(String(mockedQuery.mock.calls[0]?.[0])).toContain(
      'AND "deletedAt" IS NULL'
    );
    expect(mockedQuery.mock.calls[0]?.[1]).toEqual([
      "comment-1",
      "user@example.com",
    ]);
  });

  it("他人のコメントまたは存在しないコメントは削除できない", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "other@example.com" } });
    mockedQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(deleteComment("comment-1")).resolves.toEqual({
      ok: false,
      status: 404,
      error: "コメントが見つからないか、削除する権限がありません",
    });
  });
});
