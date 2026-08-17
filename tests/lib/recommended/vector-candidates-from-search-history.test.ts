import { beforeEach, describe, expect, it, vi } from "vitest";
import { findCandidatesFromSearchHistory } from "@/lib/Recommended/vector-candidates-from-search-history";
import { createEmbedding } from "@/app/api/admin/book-embeddings/embedding";
import { db } from "@/lib/db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));
vi.mock("@/app/api/admin/book-embeddings/embedding", () => ({
  createEmbedding: vi.fn(),
}));

const queryMock = vi.mocked(db.query);
const createEmbeddingMock = vi.mocked(createEmbedding);

describe("findCandidatesFromSearchHistory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("最新5件の検索語をベクトル化して近い本を取得する", async () => {
    const firstAt = new Date("2026-08-02T00:00:00Z");
    const secondAt = new Date("2026-08-01T00:00:00Z");
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { query: "React", occurredAt: firstAt },
          { query: "SQL", occurredAt: secondAt },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            sourceQuery: "React",
            occurredAt: firstAt,
            bookId: "book-1",
            distance: "0.25",
          },
        ],
      } as never);
    createEmbeddingMock
      .mockResolvedValueOnce([0.1, 0.2])
      .mockResolvedValueOnce([0.3, 0.4]);

    await expect(
      findCandidatesFromSearchHistory("user@example.com")
    ).resolves.toEqual([
      {
        sourceQuery: "React",
        occurredAt: firstAt,
        bookId: "book-1",
        distance: 0.25,
      },
    ]);

    expect(createEmbeddingMock.mock.calls).toEqual([
      ["React", "query"],
      ["SQL", "query"],
    ]);
    expect(queryMock.mock.calls[0]?.[1]).toEqual(["user@example.com"]);
    expect(String(queryMock.mock.calls[0]?.[0])).toContain("LIMIT 5");
    expect(String(queryMock.mock.calls[1]?.[0])).toContain("CROSS JOIN LATERAL");
    expect(String(queryMock.mock.calls[1]?.[0])).toContain("LIMIT 5");
    expect(queryMock.mock.calls[1]?.[1]).toEqual([
      ["React", "SQL"],
      [firstAt, secondAt],
      ["[0.1,0.2]", "[0.3,0.4]"],
    ]);
  });

  it("検索履歴がなければベクトル化も候補検索もしない", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);

    await expect(
      findCandidatesFromSearchHistory("user@example.com")
    ).resolves.toEqual([]);
    expect(createEmbeddingMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("1件でもEmbeddingに失敗したら候補検索を行わない", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ query: "React", occurredAt: new Date("2026-08-01T00:00:00Z") }],
    } as never);
    createEmbeddingMock.mockRejectedValueOnce(new Error("embedding error"));

    await expect(
      findCandidatesFromSearchHistory("user@example.com")
    ).rejects.toThrow("embedding error");
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
