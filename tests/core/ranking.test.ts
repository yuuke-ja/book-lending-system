import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { loanranking } from "@/lib/ranking/loan";
import { userranking } from "@/lib/ranking/user";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: { query: vi.fn() },
}));

const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

describe("ランキング取得", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("書籍貸出ランキングを返し、同数順位と上位10件のSQLを使う", async () => {
    const rows = [
      {
        bookId: "book-a",
        title: "A本",
        thumbnail: null,
        loanCount: 3,
        ranking: 1,
      },
      {
        bookId: "book-b",
        title: "B本",
        thumbnail: "thumb",
        loanCount: 3,
        ranking: 1,
      },
    ];
    mockedQuery.mockResolvedValueOnce({ rows });

    await expect(loanranking()).resolves.toEqual(rows);
    const sql = String(mockedQuery.mock.calls[0]?.[0]);
    expect(sql).toContain("RANK() OVER(ORDER BY COUNT(*) DESC)");
    expect(sql).toContain("ORDER BY ranking ASC, b.title ASC");
    expect(sql).toContain("LIMIT 10");
  });

  it("ユーザー行が欠落した貸出をnullプロフィールのまま返す", async () => {
    const rows = [
      {
        userId: null,
        nickname: null,
        avatarUrl: null,
        loanCount: 2,
        ranking: 1,
      },
    ];
    mockedQuery.mockResolvedValueOnce({ rows });

    await expect(userranking()).resolves.toEqual(rows);
    const sql = String(mockedQuery.mock.calls[0]?.[0]);
    expect(sql).toContain('LEFT JOIN "User" u ON u.email = l."userEmail"');
    expect(sql).toContain('GROUP BY l."userEmail"');
    expect(sql).toContain("LIMIT 5");
  });

  it.each([
    ["書籍", loanranking],
    ["ユーザー", userranking],
  ])("%sランキングが0件なら空配列を返す", async (_name, getRanking) => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getRanking()).resolves.toEqual([]);
  });

  it.each([
    ["書籍", loanranking],
    ["ユーザー", userranking],
  ])("%sランキングのDB例外を伝播する", async (_name, getRanking) => {
    const error = new Error("ranking query failed");
    mockedQuery.mockRejectedValueOnce(error);
    await expect(getRanking()).rejects.toBe(error);
  });
});
