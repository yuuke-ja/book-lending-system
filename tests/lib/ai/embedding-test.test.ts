import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEmbedding } from "@/app/api/admin/book-embeddings/embedding";
import {
  getEmbeddingTestBooks,
  testBookEmbeddings,
} from "@/lib/ai/embedding-test";
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
const mockedCreateEmbedding = createEmbedding as unknown as ReturnType<
  typeof vi.fn
>;

describe("embedding-test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Embedding作成済みの本を取得する", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: "book-1", title: "Web API" }],
    });

    await expect(getEmbeddingTestBooks()).resolves.toEqual([
      { id: "book-1", title: "Web API" },
    ]);
    expect(String(mockedQuery.mock.calls[0]?.[0])).toContain(
      'INNER JOIN "BookEmbedding"'
    );
  });

  it("検索語をqueryとしてベクトル化して近い本を取得する", async () => {
    mockedCreateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "book-1",
          title: "Web API",
          authors: ["著者"],
          description: "Web APIの本",
          thumbnail: null,
          tags: ["Web"],
          embeddingContent: "Web API\nWeb APIの本\nWeb",
          distance: "0.12",
          similarity: "0.88",
        },
      ],
    });

    const results = await testBookEmbeddings({
      mode: "query",
      query: "web",
      limit: 10,
    });

    expect(mockedCreateEmbedding).toHaveBeenCalledWith("web", "query");
    expect(mockedQuery.mock.calls[0]?.[1]).toEqual(["[0.1,0.2,0.3]", 10]);
    expect(results[0]).toMatchObject({
      title: "Web API",
      distance: 0.12,
      similarity: 0.88,
    });
  });

  it("基準本のベクトルを使い、その本自体を除外する", async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ embedding: "[0.4,0.5,0.6]" }] })
      .mockResolvedValueOnce({ rows: [] });

    await testBookEmbeddings({
      mode: "book",
      bookId: "source-book",
      limit: 100,
    });

    expect(mockedCreateEmbedding).not.toHaveBeenCalled();
    expect(mockedQuery.mock.calls[1]?.[1]).toEqual([
      "[0.4,0.5,0.6]",
      "source-book",
      50,
    ]);
    expect(String(mockedQuery.mock.calls[1]?.[0])).toContain("AND b.id <> $2");
  });

  it("検索語が空なら検索しない", async () => {
    await expect(
      testBookEmbeddings({ mode: "query", query: " ", limit: 10 })
    ).rejects.toThrow("検索語を入力してください");
    expect(mockedCreateEmbedding).not.toHaveBeenCalled();
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
