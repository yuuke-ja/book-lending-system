import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchBooks } from "@/lib/ai/search-books";
import { createEmbedding } from "@/app/api/admin/book-embeddings/embedding";
import { db } from "@/lib/db";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
  },
}));

vi.mock("@/app/api/admin/book-embeddings/embedding", () => ({
  createEmbedding: vi.fn(),
}));

const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;
const mockedCreateEmbedding = createEmbedding as unknown as ReturnType<typeof vi.fn>;

describe("searchBooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("空のqueryなら検索しない", async () => {
    const result = await searchBooks("   ");

    expect(result).toEqual([]);
    expect(mockedCreateEmbedding).not.toHaveBeenCalled();
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("候補本を先に絞り、communityはaiSummary優先で取得するSQLを実行する", async () => {
    mockedCreateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "book-1",
          title: "アルゴリズム入門",
          authors: ["著者A"],
          description: "アルゴリズム学習の本",
          thumbnail: null,
          distance: 0.12,
          community: ["コミュニティ本文"],
        },
      ],
    });

    const result = await searchBooks("アルゴリズム");

    expect(mockedCreateEmbedding).toHaveBeenCalledWith("アルゴリズム", "query");
    expect(mockedQuery).toHaveBeenCalledTimes(1);

    const [sql, params] = mockedQuery.mock.calls[0];
    expect(String(sql)).toContain("WITH candidate_books AS");
    expect(String(sql)).toContain("LIMIT 5");
    expect(String(sql)).toContain("community_items AS");
    expect(String(sql)).toContain('FROM "Thread" t');
    expect(String(sql)).toContain('FROM "ThreadComment" tc');
    expect(String(sql)).toContain(
      `COALESCE(NULLIF(t."aiSummary", ''), t.content) AS content`
    );
    expect(String(sql)).toContain(
      `COALESCE(NULLIF(tc."aiSummary", ''), tc.content) AS content`
    );
    expect(String(sql)).toContain("jsonb_agg");
    expect(String(sql)).toContain("LEFT JOIN community_items");
    expect(params).toEqual(["[0.1,0.2,0.3]"]);
    expect(result[0]?.community).toEqual(["コミュニティ本文"]);
  });
});
