import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBookById } from "@/lib/books/get-book-by-id";
import { getBookEmbeddingCount } from "@/lib/books/get-book-embedding-count";
import { getBookList } from "@/lib/books/get-book-list";
import { getLoanedBookIds } from "@/lib/books/get-loaned-book-ids";
import { getTagList } from "@/lib/books/get-tag-list";
import { db } from "@/lib/db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: { query: vi.fn() },
}));

const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

describe("書籍データ取得", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getBookByIdは評価とジャンルを含む1冊を返す", async () => {
    const book = {
      id: "book-1",
      title: "TypeScript入門",
      authors: ["著者A"],
      isbn13: "9781234567890",
      description: "説明",
      thumbnail: null,
      averageRating: 4.5,
      ratingCount: 2,
      tags: [{ id: "tag-1", tag: "TypeScript" }],
    };
    mockedQuery.mockResolvedValueOnce({ rows: [book], rowCount: 1 });

    await expect(getBookById("book-1")).resolves.toEqual(book);
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE b.id = $1'),
      ["book-1"]
    );
    const sql = String(mockedQuery.mock.calls[0]?.[0]);
    expect(sql).toContain('COUNT(DISTINCT br.id)::int AS "ratingCount"');
    expect(sql).toContain("jsonb_agg(DISTINCT jsonb_build_object");
  });

  it("getBookByIdは対象がなければnullを返す", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(getBookById("missing-book")).resolves.toBeNull();
  });

  it("レビューとジャンルがない詳細は平均0・件数0・空ジャンルを返す", async () => {
    const book = {
      id: "book-empty",
      title: "未評価の本",
      averageRating: 0,
      ratingCount: 0,
      tags: [],
    };
    mockedQuery.mockResolvedValueOnce({ rows: [book], rowCount: 1 });

    await expect(getBookById("book-empty")).resolves.toEqual(book);
  });

  it("getBookByIdはDB例外を呼び出し元へ返す", async () => {
    const error = new Error("book query failed");
    mockedQuery.mockRejectedValueOnce(error);
    await expect(getBookById("book-1")).rejects.toBe(error);
  });

  it("getBookListはDBの書籍一覧を返し、評価とジャンルの既定値を取得する", async () => {
    const books = [
      {
        id: "book-2",
        isbn13: "9781234567891",
        title: "新しい本",
        authors: null,
        thumbnail: null,
        averageRating: 0,
        tags: [],
      },
      {
        id: "book-1",
        isbn13: "9781234567890",
        title: "古い本",
        authors: ["著者"],
        thumbnail: "thumb",
        averageRating: 5,
        tags: [{ id: "tag-1", tag: "Web" }],
      },
    ];
    mockedQuery.mockResolvedValueOnce({ rows: books });

    await expect(getBookList()).resolves.toEqual(books);
    const sql = String(mockedQuery.mock.calls[0]?.[0]);
    expect(sql).toContain('COALESCE(rs."averageRating", 0)');
    expect(sql).toContain(`COALESCE(ts."tags", '[]'::jsonb)`);
    expect(sql).toContain('ORDER BY b."createdAt" DESC');
  });

  it("getBookListは0件なら空配列を返す", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getBookList()).resolves.toEqual([]);
  });

  it("getBookListのDB例外を呼び出し元へ返す", async () => {
    const error = new Error("book list query failed");
    mockedQuery.mockRejectedValueOnce(error);
    await expect(getBookList()).rejects.toBe(error);
  });

  it.each([
    ["12", 12],
    ["0", 0],
  ])("Embedding件数 %s を数値 %s に変換する", async (count, expected) => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ count }] });
    await expect(getBookEmbeddingCount()).resolves.toBe(expected);
    expect(String(mockedQuery.mock.calls[0]?.[0])).toContain(
      'COUNT(*)::text AS count FROM "BookEmbedding"'
    );
  });

  it("Embedding件数の行がなければ0を返す", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getBookEmbeddingCount()).resolves.toBe(0);
  });
});

describe("貸出中ID取得", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未返却のbookIdをDB順で配列化する", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ bookId: "book-new" }, { bookId: "book-old" }],
    });

    await expect(getLoanedBookIds()).resolves.toEqual(["book-new", "book-old"]);
    const sql = String(mockedQuery.mock.calls[0]?.[0]);
    expect(sql).toContain('WHERE l."returnedAt" IS NULL');
    expect(sql).toContain('ORDER BY l."loanedAt" DESC');
  });

  it("貸出中の本がなければ空配列を返す", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getLoanedBookIds()).resolves.toEqual([]);
  });

  it("同じbookIdの未返却行が複数あればDB行どおり重複を保持する", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ bookId: "book-1" }, { bookId: "book-1" }],
    });

    await expect(getLoanedBookIds()).resolves.toEqual(["book-1", "book-1"]);
  });

  it("DB例外を呼び出し元へ返す", async () => {
    const error = new Error("loan query failed");
    mockedQuery.mockRejectedValueOnce(error);
    await expect(getLoanedBookIds()).rejects.toBe(error);
  });
});

describe("ジャンル一覧取得", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ジャンルを名前の昇順で取得して返す", async () => {
    const tags = [
      { id: "tag-a", tag: "AI" },
      { id: "tag-w", tag: "Web" },
    ];
    mockedQuery.mockResolvedValueOnce({ rows: tags });

    await expect(getTagList()).resolves.toEqual(tags);
    expect(String(mockedQuery.mock.calls[0]?.[0])).toContain(
      'SELECT id, tag FROM "TagList" ORDER BY tag ASC'
    );
  });

  it("ジャンルがなければ空配列を返す", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getTagList()).resolves.toEqual([]);
  });

  it("DB例外を呼び出し元へ返す", async () => {
    const error = new Error("tag query failed");
    mockedQuery.mockRejectedValueOnce(error);
    await expect(getTagList()).rejects.toBe(error);
  });
});
