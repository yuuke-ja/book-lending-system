import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/book-registration/route";
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
const mockedTransaction = db.transaction as unknown as ReturnType<typeof vi.fn>;

describe("POST /api/admin/book-registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const res = await POST(new Request("http://localhost/api/admin/book-registration") as any);

    expect(res.status).toBe(401);
  });

  it("成功時は200を返しトランザクション内でPendingBookをBookへ登録する", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
    mockedQuery.mockResolvedValue({
      rows: [
        {
          googleBookId: "g1",
          isbn13: "9781234567890",
          title: "Test Book",
          authors: ["A Author"],
          description: "desc",
          thumbnail: "thumb",
        },
      ],
    });

    const txQuery = vi.fn().mockResolvedValue({});
    mockedTransaction.mockImplementation(async (callback: any) => {
      return callback({ query: txQuery });
    });

    const res = await POST(new Request("http://localhost/api/admin/book-registration") as any);

    expect(res.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedTransaction).toHaveBeenCalledTimes(1);
    expect(txQuery).toHaveBeenCalled();
    expect(
      txQuery.mock.calls.some((call) =>
        String(call[0]).includes('DELETE FROM "PendingBook"')
      )
    ).toBe(true);
  });
});
