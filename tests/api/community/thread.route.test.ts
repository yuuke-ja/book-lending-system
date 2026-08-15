import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/community/thread/route";
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

describe("GET /api/community/thread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    expect(String(mockedQuery.mock.calls[0]?.[0])).toContain(
      'LEFT JOIN "Book" AS b'
    );
    expect(mockedQuery.mock.calls[0]?.[1]).toEqual(["book-2"]);
    expect(data[0].bookId).toBe("book-2");
    expect(data[0].linkedBook).toEqual({
      id: "book-2",
      title: "設計入門",
      thumbnail: null,
    });
  });
});
