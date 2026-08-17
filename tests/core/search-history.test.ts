import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  getSearchHistory,
  getzerokSearchHistory,
} from "@/lib/search-history/get-search-history";

vi.mock("@/lib/db", () => ({
  db: { query: vi.fn() },
}));

const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

describe("検索履歴取得", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("全検索履歴を時刻とidの降順で30件まで返す", async () => {
    const rows = [
      {
        searchType: "book_list",
        query: "TypeScript",
        occurredAt: new Date("2026-08-15T10:00:00.000Z"),
        count: "3",
      },
      {
        searchType: "ai_query",
        query: "設計の本",
        occurredAt: new Date("2026-08-15T10:00:00.000Z"),
        count: "0",
      },
    ];
    mockedQuery.mockResolvedValueOnce({ rows });

    await expect(getSearchHistory()).resolves.toEqual(rows);
    const sql = String(mockedQuery.mock.calls[0]?.[0]);
    expect(sql).not.toContain("WHERE count = 0");
    expect(sql).toContain('ORDER BY "occurredAt" DESC, id DESC');
    expect(sql).toContain("LIMIT 30");
  });

  it("検索結果0件の履歴だけを同じ順序で取得する", async () => {
    const rows = [
      {
        searchType: "ai_query",
        query: "見つからない本",
        occurredAt: new Date("2026-08-15T10:00:00.000Z"),
        count: "0",
      },
    ];
    mockedQuery.mockResolvedValueOnce({ rows });

    await expect(getzerokSearchHistory()).resolves.toEqual(rows);
    const sql = String(mockedQuery.mock.calls[0]?.[0]);
    expect(sql).toContain("WHERE count = 0");
    expect(sql).toContain('ORDER BY "occurredAt" DESC, id DESC');
    expect(sql).toContain("LIMIT 30");
  });

  it.each([
    ["全件", getSearchHistory],
    ["0件のみ", getzerokSearchHistory],
  ])("%sの検索履歴がなければ空配列を返す", async (_name, getHistory) => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getHistory()).resolves.toEqual([]);
  });

  it.each([
    ["全件", getSearchHistory],
    ["0件のみ", getzerokSearchHistory],
  ])("%sの検索履歴取得でDB例外を伝播する", async (_name, getHistory) => {
    const error = new Error("search history query failed");
    mockedQuery.mockRejectedValueOnce(error);
    await expect(getHistory()).rejects.toBe(error);
  });
});
