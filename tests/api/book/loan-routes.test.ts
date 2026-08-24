import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getAllActiveBookIds } from "@/app/api/book/Everyoneborrowed/route";
import { GET as getBookStatus } from "@/app/api/book/bookStatus/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLoanedBookIds } from "@/lib/books/get-loaned-book-ids";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));
vi.mock("@/lib/books/get-loaned-book-ids", () => ({ getLoanedBookIds: vi.fn() }));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = vi.mocked(db.query);
const mockedGetLoanedBookIds = vi.mocked(getLoanedBookIds);

describe("貸出一覧API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([null, { user: {} }])("/api/book/Everyoneborrowed はメールがなければ401", async (session) => {
    mockedAuth.mockResolvedValue(session as never);

    const response = await getAllActiveBookIds();

    expect(response.status).toBe(401);
    expect(mockedGetLoanedBookIds).not.toHaveBeenCalled();
  });

  it("/api/book/Everyoneborrowed は貸出中bookIdをオブジェクトへ変換する", async () => {
    mockedGetLoanedBookIds.mockResolvedValueOnce(["book-1", "book-2"]);

    const response = await getAllActiveBookIds();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { bookId: "book-1" },
      { bookId: "book-2" },
    ]);
  });

  it("/api/book/Everyoneborrowed は依存障害なら500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedGetLoanedBookIds.mockRejectedValueOnce(new Error("database error"));

    const response = await getAllActiveBookIds();

    expect(response.status).toBe(500);
  });

  it.each([null, { user: {} }])("/api/book/bookStatus はメールがなければ401", async (session) => {
    mockedAuth.mockResolvedValue(session as never);

    const response = await getBookStatus();

    expect(response.status).toBe(401);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("/api/book/bookStatus は今日の境界と期限超過を分類する", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00.000+09:00"));
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { title: "期限超過", dueAt: new Date("2026-08-14T23:59:59.999+09:00") },
        { title: "今日開始", dueAt: new Date("2026-08-15T00:00:00.000+09:00") },
        { title: "今日終了", dueAt: new Date("2026-08-15T23:59:59.999+09:00") },
      ],
    } as never);

    const response = await getBookStatus();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overdue.map((item: { bookTitle: string }) => item.bookTitle)).toEqual(["期限超過"]);
    expect(body.dueToday.map((item: { bookTitle: string }) => item.bookTitle)).toEqual([
      "今日開始",
      "今日終了",
    ]);
    const [sql, params] = mockedQuery.mock.calls[0];
    expect(String(sql)).toContain('l."returnedAt" IS NULL');
    expect(String(sql)).toContain('l."dueAt" IS NOT NULL');
    expect(params?.[0]).toBe("user@example.com");
    expect((params?.[1] as Date).toISOString()).toBe("2026-08-15T14:59:59.999Z");
  });

  it("/api/book/bookStatus はDB障害なら500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedQuery.mockRejectedValueOnce(new Error("database error"));

    const response = await getBookStatus();

    expect(response.status).toBe(500);
  });
});
