import { beforeEach, describe, expect, it, vi } from "vitest";
import { classifyBooks, findBookTagMatches } from "@/lib/tags/classify-books";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));

const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;
const mockedTransaction = db.transaction as unknown as ReturnType<typeof vi.fn>;

describe("単語による自動タグ付け", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("親タグまたは小要素の単語列が一致した本だけを返す", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          bookId: "book-unity",
          title: "Unity入門",
          tagId: "tag-csharp",
          matchedTerm: "C#",
        },
        {
          bookId: "book-sql",
          title: "SQL入門",
          tagId: "tag-db",
          matchedTerm: "SQL",
        },
      ],
    });

    const rows = await findBookTagMatches();

    expect(rows).toEqual([
      {
        bookId: "book-unity",
        title: "Unity入門",
        tagId: "tag-csharp",
        matchedTerm: "C#",
      },
      {
        bookId: "book-sql",
        title: "SQL入門",
        tagId: "tag-db",
        matchedTerm: "SQL",
      },
    ]);
  });

  it("手動タグを残して旧ベクトルタグと単語タグだけを入れ直す", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          bookId: "book-1",
          title: "Web入門",
          tagId: "tag-web",
          matchedTerm: "Web",
        },
      ],
    });

    const txQuery = vi.fn().mockResolvedValue({ rows: [] });
    mockedTransaction.mockImplementation(
      async (callback: (tx: { query: typeof txQuery }) => Promise<unknown>) =>
        callback({ query: txQuery })
    );

    await classifyBooks();

    expect(String(txQuery.mock.calls[0][0])).toContain(
      "source IN ('vector', 'keyword')"
    );
    expect(String(txQuery.mock.calls[1][0])).toContain("'keyword'");
  });

  it("PGroongaインデックス検索で本と判定語を比較する", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    await findBookTagMatches({ tagIds: ["tag-csharp"], bookIds: ["book-1"] });

    expect(String(mockedQuery.mock.calls[0][0])).toContain("&@~");
    expect(String(mockedQuery.mock.calls[0][0])).toContain("pgroonga_query_escape");
    expect(String(mockedQuery.mock.calls[0][0])).not.toContain("pgroonga_tokenize");
    expect(mockedQuery.mock.calls[0][1]).toEqual([["tag-csharp"], ["book-1"]]);
  });

  it("対象IDが空配列なら全件扱いせずDBを更新しない", async () => {
    await expect(findBookTagMatches({ tagIds: [] })).resolves.toEqual([]);
    expect(mockedQuery).not.toHaveBeenCalled();

    await expect(classifyBooks({ bookIds: [] })).resolves.toEqual([]);
    expect(mockedTransaction).not.toHaveBeenCalled();
  });
});
