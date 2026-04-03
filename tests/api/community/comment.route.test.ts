import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/community/comment/route";
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
const mockedTransaction = db.transaction as unknown as ReturnType<typeof vi.fn>;

describe("/api/community/comment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const req = new Request("http://localhost/api/community/comment", {
      method: "POST",
      body: JSON.stringify({
        threadId: "thread-1",
        content: "コメントです",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("threadIdが不正なとき400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const req = new Request("http://localhost/api/community/comment", {
      method: "POST",
      body: JSON.stringify({
        threadId: "",
        content: "コメントです",
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("threadIdが不正です");
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("通常コメントを保存できる", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "thread-1" }] });

    const txQuery = vi.fn().mockResolvedValueOnce({
      rows: [{ id: "comment-1" }],
    });
    mockedTransaction.mockImplementation(
      async (callback: (tx: { query: typeof txQuery }) => Promise<unknown>) =>
        callback({ query: txQuery })
    );

    const req = new Request("http://localhost/api/community/comment", {
      method: "POST",
      body: JSON.stringify({
        threadId: "thread-1",
        content: "  コメントです  ",
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(txQuery).toHaveBeenCalledTimes(1);
    expect(txQuery.mock.calls[0]?.[1]).toEqual([
      "thread-1",
      null,
      "user@example.com",
      "コメントです",
    ]);
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
        rows: [{ id: "comment-reply-1" }],
      })
      .mockResolvedValueOnce({ rows: [] });
    mockedTransaction.mockImplementation(
      async (callback: (tx: { query: typeof txQuery }) => Promise<unknown>) =>
        callback({ query: txQuery })
    );

    const req = new Request("http://localhost/api/community/comment", {
      method: "POST",
      body: JSON.stringify({
        threadId: "thread-1",
        parentCommentId: "comment-parent",
        content: "返信です",
        bookIds: ["book-1", "book-2", "book-1"],
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockedQuery).toHaveBeenCalledTimes(3);
    expect(txQuery).toHaveBeenCalledTimes(2);
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

  it("親コメントのthreadIdが一致しないとき400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "thread-1" }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "comment-parent", threadId: "thread-other" }],
      });

    const req = new Request("http://localhost/api/community/comment", {
      method: "POST",
      body: JSON.stringify({
        threadId: "thread-1",
        parentCommentId: "comment-parent",
        content: "返信です",
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("親コメントのthreadIdが一致しません");
    expect(mockedTransaction).not.toHaveBeenCalled();
  });
});
