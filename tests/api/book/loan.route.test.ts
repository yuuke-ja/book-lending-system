import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/book/loan/route";
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

describe("POST /api/book/loan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-21T09:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const req = new Request("http://localhost/api/book/loan", {
      method: "POST",
      body: JSON.stringify({ bookId: "book-1" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("fridayOnlyが有効で開放期間外のとき403を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: "settings-1", fridayOnly: true, loanPeriodDays: 2 }],
    });
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const req = new Request("http://localhost/api/book/loan", {
      method: "POST",
      body: JSON.stringify({ bookId: "book-1" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it("貸出作成に成功したとき200を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: "settings-1", fridayOnly: false, loanPeriodDays: 2 }],
    });
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: "book-1" }] });
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockedQuery.mockResolvedValueOnce({});

    const req = new Request("http://localhost/api/book/loan", {
      method: "POST",
      body: JSON.stringify({ bookId: "book-1" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(5);
  });
});
