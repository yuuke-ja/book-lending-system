import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/book/return/route";
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

describe("POST /api/book/return", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const req = new Request("http://localhost/api/book/return", {
      method: "POST",
      body: JSON.stringify({ bookId: "book-1" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("返却対象の貸出が見つからないとき404を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValue({ rowCount: 0 });

    const req = new Request("http://localhost/api/book/return", {
      method: "POST",
      body: JSON.stringify({ bookId: "book-1" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("返却に成功したとき200を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValue({ rowCount: 1 });

    const req = new Request("http://localhost/api/book/return", {
      method: "POST",
      body: JSON.stringify({ bookId: "book-1" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });
});
