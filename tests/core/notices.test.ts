import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getNotices } from "@/lib/notices/get-notices";

vi.mock("@/lib/db", () => ({
  db: { query: vi.fn() },
}));

const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

describe("getNotices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("本付きと本なしのお知らせをlinkedBookへ整形する", async () => {
    const content = { type: "doc", content: [{ type: "paragraph" }] };
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "notice-1",
          title: "新着本",
          content,
          bookId: "book-1",
          createdAt: "2026-08-15T10:00:00.000Z",
          linkedBookTitle: "TypeScript入門",
          linkedBookThumbnail: "thumb",
        },
        {
          id: "notice-2",
          title: "休館日",
          content: { type: "doc" },
          bookId: null,
          createdAt: "2026-08-14T10:00:00.000Z",
          linkedBookTitle: null,
          linkedBookThumbnail: null,
        },
      ],
    });

    await expect(getNotices()).resolves.toEqual([
      {
        id: "notice-1",
        title: "新着本",
        content,
        createdAt: "2026-08-15T10:00:00.000Z",
        linkedBook: {
          id: "book-1",
          title: "TypeScript入門",
          thumbnail: "thumb",
        },
      },
      {
        id: "notice-2",
        title: "休館日",
        content: { type: "doc" },
        createdAt: "2026-08-14T10:00:00.000Z",
        linkedBook: null,
      },
    ]);
    expect(String(mockedQuery.mock.calls[0]?.[0])).toContain(
      'ORDER BY n."createdAt" DESC'
    );
  });

  it("bookIdの結合先がなければフォールバックタイトルを使う", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "notice-1",
          title: "お知らせ",
          content: { type: "doc" },
          bookId: "missing-book",
          createdAt: "2026-08-15T10:00:00.000Z",
          linkedBookTitle: null,
          linkedBookThumbnail: null,
        },
      ],
    });

    const result = await getNotices();
    expect(result[0].linkedBook).toEqual({
      id: "missing-book",
      title: "関連する本",
      thumbnail: null,
    });
  });

  it("お知らせがなければ空配列を返す", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getNotices()).resolves.toEqual([]);
  });

  it("DB例外を呼び出し元へ返す", async () => {
    const error = new Error("notice query failed");
    mockedQuery.mockRejectedValueOnce(error);
    await expect(getNotices()).rejects.toBe(error);
  });
});
