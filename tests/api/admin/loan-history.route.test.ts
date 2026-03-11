import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/admin/loan-history/route";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/admin", () => ({ Admin: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedAdmin = Admin as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

function createRequest(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return new Request(`http://localhost/api/admin/loan-history${query}`);
}

describe("GET /api/admin/loan-history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const res = await GET(createRequest());

    expect(res.status).toBe(401);
  });

  it("管理者以外は403を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedAdmin.mockResolvedValue(false);

    const res = await GET(createRequest());

    expect(res.status).toBe(403);
  });

  it("不正なstatusなら400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);

    const res = await GET(createRequest("invalid"));

    expect(res.status).toBe(400);
  });

  it("status未指定なら全件取得する", async () => {
    const rows = [
      {
        loanId: "loan-1",
        userEmail: "user@example.com",
        bookId: "book-1",
        loanedAt: "2026-03-11T10:00:00.000Z",
        returnedAt: null,
        dueAt: "2026-03-18T10:00:00.000Z",
        bookTitle: "テスト本",
        bookThumbnail: "thumb",
        bookIsbn13: "9781234567890",
        bookAuthors: ["著者A"],
        status: "borrowing",
      },
    ];
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
    mockedQuery.mockResolvedValue({ rows });

    const res = await GET(createRequest());
    const data = await res.json();
    const sql = mockedQuery.mock.calls[0]?.[0] as string;

    expect(res.status).toBe(200);
    expect(data).toEqual(rows);
    expect(sql).not.toContain('WHERE l."returnedAt" IS NULL');
    expect(sql).not.toContain('WHERE l."returnedAt" IS NOT NULL');
  });

  it("貸出中フィルターなら未返却だけ取得するSQLで問い合わせる", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
    mockedQuery.mockResolvedValue({ rows: [] });

    const res = await GET(createRequest("borrowing"));
    const sql = mockedQuery.mock.calls[0]?.[0] as string;

    expect(res.status).toBe(200);
    expect(sql).toContain('WHERE l."returnedAt" IS NULL');
  });

  it("返却済みフィルターなら返却済みだけ取得するSQLで問い合わせる", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
    mockedQuery.mockResolvedValue({ rows: [] });

    const res = await GET(createRequest("returned"));
    const sql = mockedQuery.mock.calls[0]?.[0] as string;

    expect(res.status).toBe(200);
    expect(sql).toContain('WHERE l."returnedAt" IS NOT NULL');
  });
});
