import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/book/review/route";
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

describe("/api/book/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET: bookIdがないとき400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const res = await GET(new Request("http://localhost/api/book/review"));

    expect(res.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("POST: 星がない(不正)とき400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const req = new Request("http://localhost/api/book/review", {
      method: "POST",
      body: JSON.stringify({
        bookId: "book-1",
        comment: "先にコメントだけ入れた",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("POST: コメントが文字列でないとき400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const req = new Request("http://localhost/api/book/review", {
      method: "POST",
      body: JSON.stringify({
        bookId: "book-1",
        rating: 4,
        comment: 123,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("POST: 星+コメントで保存できる", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({ rowCount: 1 });
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "review-1",
          userEmail: "user@example.com",
          bookId: "book-1",
          rating: 5,
          comment: "おもしろかった",
        },
      ],
    });

    const req = new Request("http://localhost/api/book/review", {
      method: "POST",
      body: JSON.stringify({
        bookId: "book-1",
        rating: 5,
        comment: "おもしろかった",
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedQuery.mock.calls[1]?.[1]).toEqual([
      "user@example.com",
      "book-1",
      5,
      "おもしろかった",
    ]);
    expect(data.ok).toBe(true);
  });

  it("POST: コメントなしで星だけでも保存できる", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({ rowCount: 1 });
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "review-2",
          userEmail: "user@example.com",
          bookId: "book-1",
          rating: 3,
          comment: null,
        },
      ],
    });

    const req = new Request("http://localhost/api/book/review", {
      method: "POST",
      body: JSON.stringify({
        bookId: "book-1",
        rating: 3,
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedQuery.mock.calls[1]?.[1]).toEqual([
      "user@example.com",
      "book-1",
      3,
      null,
    ]);
    expect(data.ok).toBe(true);
    expect(data.data.comment).toBeNull();
  });
});
