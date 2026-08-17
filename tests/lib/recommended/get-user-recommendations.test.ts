import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserRecommendations } from "@/lib/Recommended/get-user-recommendations";
import { db } from "@/lib/db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));

const queryMock = vi.mocked(db.query);

describe("getUserRecommendations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("指定ユーザーの推薦を順位順で最大8件取得する", async () => {
    const rows = [
      {
        id: "book-1",
        title: "Book 1",
        authors: ["Author"],
        isbn13: "9780000000001",
        thumbnail: null,
        rank: 1,
      },
    ];
    queryMock.mockResolvedValueOnce({ rows } as never);

    await expect(
      getUserRecommendations("user@example.com")
    ).resolves.toEqual(rows);

    const [sql, params] = queryMock.mock.calls[0];
    expect(String(sql)).toContain('WHERE recommendation."userEmail" = $1');
    expect(String(sql)).toContain("ORDER BY recommendation.rank ASC");
    expect(String(sql)).toContain("LIMIT 8");
    expect(params).toEqual(["user@example.com"]);
  });

  it("推薦がなければ空配列を返す", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    await expect(
      getUserRecommendations("user@example.com")
    ).resolves.toEqual([]);
  });

  it("DBエラーを呼び出し元へ返す", async () => {
    queryMock.mockRejectedValueOnce(new Error("database error"));
    await expect(
      getUserRecommendations("user@example.com")
    ).rejects.toThrow("database error");
  });
});
