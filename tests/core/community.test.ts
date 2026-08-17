import { beforeEach, describe, expect, it, vi } from "vitest";
import { getThreadDetail } from "@/lib/community/get-thread-detail";
import { getThreadList } from "@/lib/community/get-thread-list";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: { query: vi.fn() },
}));

const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

describe("getThreadList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bookId指定なしで全件を取得しlinkedBookを整形する", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "thread-book",
          content: "本の話",
          bookId: "book-1",
          kind: "BOOK_TOPIC",
          createdAt: "2026-08-15T10:00:00.000Z",
          bookTitle: "DDD本",
          bookThumbnail: "thumb",
          nickname: "太郎",
          authorAvatarUrl: "avatar",
        },
        {
          id: "thread-request",
          content: "おすすめは？",
          bookId: null,
          kind: "BOOK_REQUEST",
          createdAt: "2026-08-14T10:00:00.000Z",
          nickname: null,
          authorAvatarUrl: null,
        },
      ],
    });

    await expect(getThreadList()).resolves.toEqual([
      {
        id: "thread-book",
        content: "本の話",
        bookId: "book-1",
        kind: "BOOK_TOPIC",
        createdAt: "2026-08-15T10:00:00.000Z",
        linkedBook: { id: "book-1", title: "DDD本", thumbnail: "thumb" },
        nickname: "太郎",
        authorAvatarUrl: "avatar",
      },
      {
        id: "thread-request",
        content: "おすすめは？",
        bookId: null,
        kind: "BOOK_REQUEST",
        createdAt: "2026-08-14T10:00:00.000Z",
        linkedBook: null,
        nickname: null,
        authorAvatarUrl: null,
      },
    ]);
    expect(mockedQuery.mock.calls[0]).toHaveLength(1);
    expect(String(mockedQuery.mock.calls[0]?.[0])).not.toContain(
      'WHERE t."bookId" = $1'
    );
  });

  it("bookId指定時は対象本だけ検索し欠落した結合値を補う", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "thread-1",
          content: "本の話",
          bookId: "book-1",
          kind: "BOOK_TOPIC",
          createdAt: "2026-08-15T10:00:00.000Z",
          bookTitle: null,
          bookThumbnail: null,
        },
      ],
    });

    const result = await getThreadList("book-1");

    expect(mockedQuery.mock.calls[0]?.[1]).toEqual(["book-1"]);
    expect(String(mockedQuery.mock.calls[0]?.[0])).toContain(
      'WHERE t."bookId" = $1'
    );
    expect(result[0]).toMatchObject({
      linkedBook: { id: "book-1", title: "関連する本", thumbnail: null },
      nickname: null,
      authorAvatarUrl: null,
    });
  });

  it("DB例外を呼び出し元へ返す", async () => {
    const error = new Error("thread list failed");
    mockedQuery.mockRejectedValueOnce(error);
    await expect(getThreadList()).rejects.toBe(error);
  });
});

describe("getThreadDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("スレッドがなければnullを返して後続queryを行わない", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(getThreadDetail("missing-thread")).resolves.toBeNull();
    expect(mockedQuery).toHaveBeenCalledOnce();
    expect(mockedQuery.mock.calls[0]?.[1]).toEqual(["missing-thread"]);
  });

  it("スレッド本とコメントごとの複数リンク本を整形する", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "thread-1",
            content: "本文",
            bookId: "book-main",
            kind: "BOOK_TOPIC",
            createdAt: "2026-08-15T10:00:00.000Z",
            nickname: "投稿者",
            authorAvatarUrl: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "book-main", title: "主題本", thumbnail: "main-thumb" }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "comment-1",
            threadId: "thread-1",
            parentCommentId: null,
            content: "親コメント",
            createdAt: "2026-08-15T11:00:00.000Z",
            nickname: "親",
            authorAvatarUrl: null,
          },
          {
            id: "comment-2",
            threadId: "thread-1",
            parentCommentId: "comment-1",
            content: "返信",
            createdAt: "2026-08-15T12:00:00.000Z",
            nickname: "子",
            authorAvatarUrl: "avatar",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            commentId: "comment-1",
            id: "book-a",
            title: "関連A",
            thumbnail: null,
          },
          {
            commentId: "comment-1",
            id: "book-b",
            title: "関連B",
            thumbnail: "thumb-b",
          },
        ],
      });

    const detail = await getThreadDetail("thread-1");

    expect(mockedQuery).toHaveBeenCalledTimes(4);
    expect(mockedQuery.mock.calls[3]?.[1]).toEqual([
      ["comment-1", "comment-2"],
    ]);
    expect(detail?.thread.linkedBook).toEqual({
      id: "book-main",
      title: "主題本",
      thumbnail: "main-thumb",
    });
    expect(detail?.comments[0].linkedBooks).toEqual([
      { id: "book-a", title: "関連A", thumbnail: null },
      { id: "book-b", title: "関連B", thumbnail: "thumb-b" },
    ]);
    expect(detail?.comments[1].linkedBooks).toEqual([]);
  });

  it("本もコメントもないスレッドでは不要なqueryを省略する", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "thread-1",
            content: "おすすめは？",
            bookId: null,
            kind: "BOOK_REQUEST",
            createdAt: "2026-08-15T10:00:00.000Z",
            nickname: null,
            authorAvatarUrl: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(getThreadDetail("thread-1")).resolves.toMatchObject({
      thread: { linkedBook: null },
      comments: [],
    });
    expect(mockedQuery).toHaveBeenCalledTimes(2);
  });

  it("bookIdに対応する本が消えていればlinkedBookをnullにする", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "thread-1",
            content: "本文",
            bookId: "missing-book",
            kind: "BOOK_TOPIC",
            createdAt: "2026-08-15T10:00:00.000Z",
            nickname: null,
            authorAvatarUrl: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const detail = await getThreadDetail("thread-1");
    expect(detail?.thread.linkedBook).toBeNull();
    expect(detail?.comments).toEqual([]);
  });
});
