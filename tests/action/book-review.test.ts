import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveBookReview } from "@/lib/action/book-review";
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

describe("saveBookReview Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const result = await saveBookReview({ bookId: "book-1", rating: 5 });

    expect(result.status).toBe(401);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("星がないとき400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const result = await saveBookReview({
      bookId: "book-1",
      comment: "先にコメントだけ入れた",
    });

    expect(result.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("コメントが文字列でないとき400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const result = await saveBookReview({
      bookId: "book-1",
      rating: 4,
      comment: 123,
    });

    expect(result.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("本が見つからないとき404を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({ rowCount: 0 });

    const result = await saveBookReview({ bookId: "book-1", rating: 4 });

    expect(result.status).toBe(404);
    expect(mockedQuery).toHaveBeenCalledOnce();
  });

  it("星とコメントを保存できる", async () => {
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

    const result = await saveBookReview({
      bookId: "book-1",
      rating: 5,
      comment: "おもしろかった",
    });

    expect(result.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedQuery.mock.calls[1]?.[1]).toEqual([
      "user@example.com",
      "book-1",
      5,
      "おもしろかった",
    ]);
    expect(result.ok && result.data.comment).toBe("おもしろかった");
  });

  it("コメントなしで星だけでも保存できる", async () => {
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

    const result = await saveBookReview({ bookId: "book-1", rating: 3 });

    expect(result.status).toBe(200);
    expect(mockedQuery.mock.calls[1]?.[1]).toEqual([
      "user@example.com",
      "book-1",
      3,
      null,
    ]);
    expect(result.ok && result.data.comment).toBeNull();
  });
});
