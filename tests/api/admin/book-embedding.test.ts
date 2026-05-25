import { beforeEach, describe, expect, it, vi } from "vitest";
import { rebuildBookEmbeddings } from "@/app/api/admin/book-embeddings/book-embedding";
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

describe("rebuildBookEmbeddings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bookIdが空ならDBもベクトル化も実行しない", async () => {
    const count = await rebuildBookEmbeddings([]);

    expect(count).toBe(0);
    expect(mockedQuery).not.toHaveBeenCalled();
    expect(mockedCreateEmbedding).not.toHaveBeenCalled();
  });

  it("指定されたbookIdだけをベクトル化してBookEmbeddingへ保存する", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: "book-2",
            title: "React入門",
            authors: ["山田太郎"],
            description: "Reactの基本を学ぶ本",
            tags: "Web,JavaScript",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    mockedCreateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);

    const count = await rebuildBookEmbeddings(["book-2", "book-2", ""]);

    expect(count).toBe(1);
    expect(mockedQuery).toHaveBeenCalledTimes(2);

    const [selectSql, selectParams] = mockedQuery.mock.calls[0];
    expect(String(selectSql)).toContain("WHERE b.id = ANY($1::text[])");
    expect(selectParams).toEqual([["book-2"]]);

    expect(mockedCreateEmbedding).toHaveBeenCalledWith(
      [
        "React入門",
        "山田太郎",
        "Reactの基本を学ぶ本",
        "Web,JavaScript",
      ],
      "passage"
    );

    const [insertSql, insertParams] = mockedQuery.mock.calls[1];
    expect(String(insertSql)).toContain('INSERT INTO "BookEmbedding"');
    expect(String(insertSql)).toContain('ON CONFLICT ("bookId") DO UPDATE');
    expect(String(insertSql)).toContain("content = EXCLUDED.content");
    expect(String(insertSql)).toContain("embedding = EXCLUDED.embedding");
    expect(insertParams).toEqual([
      "book-2",
      "React入門\n山田太郎\nReactの基本を学ぶ本\nWeb,JavaScript",
      "[0.1,0.2,0.3]",
    ]);
  });

  it("複数件をまとめてINSERTする", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: "book-1",
            title: "Book One",
            authors: ["Author One"],
            description: null,
            tags: null,
          },
          {
            id: "book-2",
            title: "Book Two",
            authors: null,
            description: "Description Two",
            tags: "Tag Two",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 2 });
    mockedCreateEmbedding
      .mockResolvedValueOnce([1, 1, 1])
      .mockResolvedValueOnce([2, 2, 2]);

    const count = await rebuildBookEmbeddings(["book-1", "book-2"]);

    expect(count).toBe(2);

    const [insertSql, insertParams] = mockedQuery.mock.calls[1];
    expect(String(insertSql)).toContain(
      "($1, $2, $3::vector, now()), ($4, $5, $6::vector, now())"
    );
    expect(insertParams).toEqual([
      "book-1",
      "Book One\nAuthor One",
      "[1,1,1]",
      "book-2",
      "Book Two\nDescription Two\nTag Two",
      "[2,2,2]",
    ]);
  });

  it("対象の本が見つからない場合は保存しない", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const count = await rebuildBookEmbeddings(["missing-book"]);

    expect(count).toBe(0);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedCreateEmbedding).not.toHaveBeenCalled();
  });
});
