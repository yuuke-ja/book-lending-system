import { beforeEach, describe, expect, it, vi } from "vitest";
import { shouldRefreshRecommendations } from "@/lib/Recommended/should-refresh-recommendations";
import { db } from "@/lib/db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));

const queryMock = vi.mocked(db.query);

describe("shouldRefreshRecommendations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("まだ推薦を生成していなければ更新する", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          lastGeneratedAt: null,
          latestLogAt: new Date("2026-08-01T00:00:00Z"),
        },
      ],
    } as never);

    await expect(
      shouldRefreshRecommendations("user@example.com")
    ).resolves.toBe(true);
    expect(queryMock.mock.calls[0]?.[1]).toEqual(["user@example.com"]);
  });

  it.each([
    ["行動履歴", 'FROM "ResearchEvent"'],
    ["検索履歴", 'FROM "SearchEvent"'],
  ])("推薦生成後に新しい%sがあれば更新する", async (_name, sourceSql) => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          lastGeneratedAt: new Date("2026-08-01T00:00:00Z"),
          latestLogAt: new Date("2026-08-01T00:00:01Z"),
        },
      ],
    } as never);

    await expect(
      shouldRefreshRecommendations("user@example.com")
    ).resolves.toBe(true);
    expect(String(queryMock.mock.calls[0]?.[0])).toContain(sourceSql);
  });

  it.each([
    ["同時刻", "2026-08-01T00:00:00Z"],
    ["古いログ", "2026-07-31T23:59:59Z"],
  ])("%sなら更新しない", async (_name, latestLogAt) => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          lastGeneratedAt: new Date("2026-08-01T00:00:00Z"),
          latestLogAt: new Date(latestLogAt),
        },
      ],
    } as never);

    await expect(
      shouldRefreshRecommendations("user@example.com")
    ).resolves.toBe(false);
  });

  it("行動履歴と検索履歴の最新時刻を比較するSQLを使う", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          lastGeneratedAt: new Date("2026-08-01T00:00:00Z"),
          latestLogAt: new Date("2026-08-01T00:00:00Z"),
        },
      ],
    } as never);

    await shouldRefreshRecommendations("user@example.com");

    const sql = String(queryMock.mock.calls[0]?.[0]);
    expect(sql).toContain('FROM "UserRecommendation"');
    expect(sql).toContain('FROM "ResearchEvent"');
    expect(sql).toContain('FROM "SearchEvent"');
    expect(sql).toContain("GREATEST");
  });
});
