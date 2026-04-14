import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/community/thread/route";
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

describe("/api/community/thread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST", () => {
    it("未ログインのとき401を返す", async () => {
      mockedAuth.mockResolvedValue(null);

      const req = new Request("http://localhost/api/community/thread", {
        method: "POST",
        body: JSON.stringify({
          kind: "BOOK_REQUEST",
          content: "探しています",
        }),
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
      expect(mockedQuery).not.toHaveBeenCalled();
    });

    it("BOOK_TOPICでbookIdがないとき400を返す", async () => {
      mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

      const req = new Request("http://localhost/api/community/thread", {
        method: "POST",
        body: JSON.stringify({
          kind: "BOOK_TOPIC",
          content: "この本どう？",
        }),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("本に紐づく投稿にはbookIdが必要です");
      expect(mockedQuery).not.toHaveBeenCalled();
    });

    it("存在しないbookIdなら404を返す", async () => {
      mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
      mockedQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const req = new Request("http://localhost/api/community/thread", {
        method: "POST",
        body: JSON.stringify({
          kind: "BOOK_TOPIC",
          bookId: "missing-book",
          content: "この本どう？",
        }),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("本が見つかりません");
      expect(mockedQuery).toHaveBeenCalledTimes(1);
    });

    it("本付きスレッドを保存できる", async () => {
      mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
      mockedQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ "?column?": 1 }] });
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "thread-1",
            content: "この本どう？",
            bookId: "book-1",
            kind: "BOOK_TOPIC",
            createdAt: "2026-04-03T10:00:00.000Z",
          },
        ],
      });

      const req = new Request("http://localhost/api/community/thread", {
        method: "POST",
        body: JSON.stringify({
          kind: "BOOK_TOPIC",
          bookId: "book-1",
          content: "  この本どう？  ",
        }),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(mockedQuery).toHaveBeenCalledTimes(2);
      expect(mockedQuery.mock.calls[1]?.[1]).toEqual([
        "BOOK_TOPIC",
        "book-1",
        "user@example.com",
        "この本どう？",
      ]);
      expect(data).toEqual({
        id: "thread-1",
        content: "この本どう？",
        bookId: "book-1",
        kind: "BOOK_TOPIC",
        createdAt: "2026-04-03T10:00:00.000Z",
      });
    });

    it("本なし相談スレッドを保存できる", async () => {
      mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "thread-2",
            content: "おすすめありますか",
            bookId: null,
            kind: "BOOK_REQUEST",
            createdAt: "2026-04-03T11:00:00.000Z",
          },
        ],
      });

      const req = new Request("http://localhost/api/community/thread", {
        method: "POST",
        body: JSON.stringify({
          kind: "BOOK_REQUEST",
          content: "おすすめありますか",
        }),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(mockedQuery).toHaveBeenCalledTimes(1);
      expect(mockedQuery.mock.calls[0]?.[1]).toEqual([
        "BOOK_REQUEST",
        null,
        "user@example.com",
        "おすすめありますか",
      ]);
      expect(data.bookId).toBeNull();
    });
  });

  describe("GET", () => {
    it("未ログインのとき401を返す", async () => {
      mockedAuth.mockResolvedValue(null);

      const res = await GET(new Request("http://localhost/api/community/thread"));

      expect(res.status).toBe(401);
      expect(mockedQuery).not.toHaveBeenCalled();
    });

    it("bookId指定なしならスレッド一覧を返す", async () => {
      mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "thread-1",
            content: "この本どう？",
            bookId: "book-1",
            kind: "BOOK_TOPIC",
            createdAt: "2026-04-03T10:00:00.000Z",
            bookTitle: "DDD本",
            bookThumbnail: "thumb-1",
          },
        ],
      });

      const res = await GET(new Request("http://localhost/api/community/thread"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(mockedQuery).toHaveBeenCalledTimes(1);
      expect(String(mockedQuery.mock.calls[0]?.[0])).toContain('FROM "Thread" t');
      expect(data[0].linkedBook).toEqual({
        id: "book-1",
        title: "DDD本",
        thumbnail: "thumb-1",
      });
    });

    it("bookId指定ありなら対象本のスレッドだけ返す", async () => {
      mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "thread-2",
            content: "この本探してます",
            bookId: "book-2",
            kind: "BOOK_TOPIC",
            createdAt: "2026-04-03T12:00:00.000Z",
            bookTitle: "設計入門",
            bookThumbnail: null,
            nickname: "太郎",
            authorAvatarUrl: null,
          },
        ],
      });

      const res = await GET(
        new Request("http://localhost/api/community/thread?bookId=book-2")
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(mockedQuery).toHaveBeenCalledTimes(1);
      expect(String(mockedQuery.mock.calls[0]?.[0])).toContain('LEFT JOIN "Book" AS b');
      expect(mockedQuery.mock.calls[0]?.[1]).toEqual(["book-2"]);
      expect(data[0].bookId).toBe("book-2");
      expect(data[0].linkedBook).toEqual({
        id: "book-2",
        title: "設計入門",
        thumbnail: null,
      });
    });
  });
});
