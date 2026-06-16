import { beforeEach, describe, expect, it, vi } from "vitest";
import { aisearcheventlog } from "@/lib/ai/aisearcheventlog";
import { db } from "@/lib/db";
import { recordSearchEvent } from "@/lib/search-event.server";

vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
  },
}));
vi.mock("@/lib/search-event.server", () => ({
  recordSearchEvent: vi.fn(),
}));

const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;
const mockedRecordSearchEvent = recordSearchEvent as unknown as ReturnType<
  typeof vi.fn
>;

describe("aisearcheventlog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRecordSearchEvent.mockResolvedValue({ id: "search-event-1" });
  });

  it("検索語がタグに一致したらconfidence 1で保存する", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: "tag-ai" }, { id: "tag-tech" }],
    });

    await aisearcheventlog({
      userEmail: "user@example.com",
      query: "AI 技術書",
      recommendedBooks: ["book-1", "book-2"],
    });

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedQuery.mock.calls[0]?.[1]).toEqual(["AI 技術書"]);
    expect(mockedRecordSearchEvent).toHaveBeenCalledWith({
      userEmail: "user@example.com",
      query: "AI 技術書",
      searchType: "ai_query",
      tagIds: ["tag-ai", "tag-tech"],
      confidence: 1,
    });
  });

  it("検索語にタグがなければ推薦本タグ上位2件をconfidence 0.5で保存する", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: "tag-design" }, { id: "tag-tech" }],
    });

    await aisearcheventlog({
      userEmail: "user@example.com",
      query: "おすすめを教えて",
      recommendedBooks: ["book-design-1", "book-tech-1", "book-design-2"],
    });

    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedQuery.mock.calls[1]?.[1]).toEqual([
      ["book-design-1", "book-tech-1", "book-design-2"],
    ]);
    expect(mockedRecordSearchEvent).toHaveBeenCalledWith({
      userEmail: "user@example.com",
      query: "おすすめを教えて",
      searchType: "ai_query",
      tagIds: ["tag-design", "tag-tech"],
      confidence: 0.5,
    });
  });

  it("検索語にも推薦本にもタグがなければタグなしで保存する", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    await aisearcheventlog({
      userEmail: "user@example.com",
      query: "タグなし",
      recommendedBooks: [],
    });

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedRecordSearchEvent).toHaveBeenCalledWith({
      userEmail: "user@example.com",
      query: "タグなし",
      searchType: "ai_query",
      tagIds: [],
      confidence: 1,
    });
  });
});
