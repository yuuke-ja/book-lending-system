import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/community/thread/[threadId]/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordResearchEvent } from "@/lib/research-event.server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));
vi.mock("@/lib/research-event.server", () => ({
  recordResearchEvent: vi.fn(),
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;
const mockedRecordResearchEvent = recordResearchEvent as unknown as ReturnType<typeof vi.fn>;

describe("/api/community/thread/[threadId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/community/thread/thread-1"), {
      params: Promise.resolve({ threadId: "thread-1" }),
    });

    expect(res.status).toBe(401);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("スレッドが存在しないとき404を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await GET(new Request("http://localhost/api/community/thread/missing"), {
      params: Promise.resolve({ threadId: "missing" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("スレッドが見つかりません");
  });

  it("スレッド詳細とコメントの紐付け本を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "thread-1",
            content: "DDDの話をしたい",
            bookId: "book-1",
            kind: "BOOK_TOPIC",
            createdAt: "2026-04-03T10:00:00.000Z",
            nickname: "しおり",
            authorAvatarUrl: "https://example.com/avatar.png",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "book-1",
            title: "DDD本",
            thumbnail: "thread-thumb",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "comment-1",
            threadId: "thread-1",
            parentCommentId: null,
            content: "最初のコメント",
            createdAt: "2026-04-03T11:00:00.000Z",
            nickname: "こめ太郎",
            authorAvatarUrl: "https://example.com/comment-1.png",
          },
          {
            id: "comment-2",
            threadId: "thread-1",
            parentCommentId: "comment-1",
            content: "返信です",
            createdAt: "2026-04-03T11:05:00.000Z",
            nickname: "返信子",
            authorAvatarUrl: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            commentId: "comment-1",
            id: "book-2",
            title: "設計本",
            thumbnail: "comment-thumb",
          },
          {
            commentId: "comment-2",
            id: "book-3",
            title: "実装本",
            thumbnail: null,
          },
        ],
      });

    const res = await GET(new Request("http://localhost/api/community/thread/thread-1"), {
      params: Promise.resolve({ threadId: "thread-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(4);
    expect(mockedRecordResearchEvent).toHaveBeenCalledWith({
      eventType: "post_view",
      userEmail: "user@example.com",
      bookId: "book-1",
      sourceType: "thread",
      sourceId: "thread-1",
    });
    expect(data.thread).toEqual({
      id: "thread-1",
      content: "DDDの話をしたい",
      bookId: "book-1",
      kind: "BOOK_TOPIC",
      createdAt: "2026-04-03T10:00:00.000Z",
      nickname: "しおり",
      authorAvatarUrl: "https://example.com/avatar.png",
      linkedBook: {
        id: "book-1",
        title: "DDD本",
        thumbnail: "thread-thumb",
      },
    });
    expect(data.comments).toEqual([
      {
        id: "comment-1",
        threadId: "thread-1",
        parentCommentId: null,
        content: "最初のコメント",
        createdAt: "2026-04-03T11:00:00.000Z",
        nickname: "こめ太郎",
        authorAvatarUrl: "https://example.com/comment-1.png",
        linkedBooks: [
          {
            id: "book-2",
            title: "設計本",
            thumbnail: "comment-thumb",
          },
        ],
      },
      {
        id: "comment-2",
        threadId: "thread-1",
        parentCommentId: "comment-1",
        content: "返信です",
        createdAt: "2026-04-03T11:05:00.000Z",
        nickname: "返信子",
        authorAvatarUrl: null,
        linkedBooks: [
          {
            id: "book-3",
            title: "実装本",
            thumbnail: null,
          },
        ],
      },
    ]);
  });

  it("コメントがないときlinkedBooksは空配列で返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "thread-2",
            content: "本を探しています",
            bookId: null,
            kind: "BOOK_REQUEST",
            createdAt: "2026-04-03T12:00:00.000Z",
            nickname: null,
            authorAvatarUrl: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    const res = await GET(new Request("http://localhost/api/community/thread/thread-2"), {
      params: Promise.resolve({ threadId: "thread-2" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedRecordResearchEvent).not.toHaveBeenCalled();
    expect(data.thread.linkedBook).toBeNull();
    expect(data.comments).toEqual([]);
  });
});
