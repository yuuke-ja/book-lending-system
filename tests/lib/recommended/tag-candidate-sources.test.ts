import { beforeEach, describe, expect, it, vi } from "vitest";
import { findTagCandidatesFromHistory } from "@/lib/Recommended/tag-candidates-from-history";
import { findTagCandidatesFromSearchHistory } from "@/lib/Recommended/tag-candidates-from-search-history";
import { db } from "@/lib/db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));

const queryMock = vi.mocked(db.query);

describe("ジャンル由来の推薦候補", () => {
  beforeEach(() => vi.clearAllMocks());

  it("行動履歴の対象イベントと同じジャンルを持つ別の本を検索する", async () => {
    const rows = [
      {
        historyBookId: "source-1",
        occurredAt: new Date("2026-08-01T00:00:00Z"),
        bookId: "candidate-1",
      },
    ];
    queryMock.mockResolvedValueOnce({ rows } as never);

    await expect(
      findTagCandidatesFromHistory("user@example.com")
    ).resolves.toEqual(rows);

    const [sql, params] = queryMock.mock.calls[0];
    const text = String(sql);
    expect(text).toContain("'loan'");
    expect(text).toContain("'book_detail_view'");
    expect(text).toContain("'book_link_click'");
    expect(text).toContain("LIMIT 10");
    expect(text).toContain('candidate_book.id <> book_events."historyBookId"');
    expect(text).toContain('candidate_tag."tagId" = source_tag."tagId"');
    expect(params).toEqual(["user@example.com"]);
  });

  it("行動履歴の候補がなければ空配列を返す", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    await expect(
      findTagCandidatesFromHistory("user@example.com")
    ).resolves.toEqual([]);
  });

  it("行動履歴ジャンル候補のDBエラーを伝播する", async () => {
    queryMock.mockRejectedValueOnce(new Error("database error"));
    await expect(
      findTagCandidatesFromHistory("user@example.com")
    ).rejects.toThrow("database error");
  });

  it("検索履歴をジャンル名と子要素の両方へ照合する", async () => {
    const rows = [
      {
        sourceQuery: "React",
        occurredAt: new Date("2026-08-01T00:00:00Z"),
        tagId: "tag-1",
        matchedTerm: "React",
        bookId: "book-1",
      },
    ];
    queryMock.mockResolvedValueOnce({ rows } as never);

    await expect(
      findTagCandidatesFromSearchHistory("user@example.com")
    ).resolves.toEqual(rows);

    const [sql, params] = queryMock.mock.calls[0];
    const text = String(sql);
    expect(text).toContain("'ai_query'");
    expect(text).toContain("'book_list'");
    expect(text).toContain("LIMIT 5");
    expect(text).toContain('JOIN "TagList"');
    expect(text).toContain('JOIN "TagSubterm"');
    expect(text).toContain("SELECT DISTINCT");
    expect(text).toContain("pgroonga_query_escape");
    expect(params).toEqual(["user@example.com"]);
  });

  it("検索履歴ジャンル候補のDBエラーを伝播する", async () => {
    queryMock.mockRejectedValueOnce(new Error("database error"));
    await expect(
      findTagCandidatesFromSearchHistory("user@example.com")
    ).rejects.toThrow("database error");
  });
});
