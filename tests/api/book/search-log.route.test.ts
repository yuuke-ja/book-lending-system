import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/book/search/log/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordSearchEvent } from "@/lib/search-event.server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
  },
}));
vi.mock("@/lib/search-event.server", () => ({
  recordSearchEvent: vi.fn(),
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;
const mockedRecordSearchEvent = recordSearchEvent as unknown as ReturnType<
  typeof vi.fn
>;

function createRequest(body: unknown) {
  return new Request("http://localhost/api/book/search/log", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/book/search/log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedRecordSearchEvent.mockResolvedValue({ id: "search-event-1" });
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const res = await POST(createRequest({ query: "技術書" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "認証できない" });
    expect(mockedQuery).not.toHaveBeenCalled();
    expect(mockedRecordSearchEvent).not.toHaveBeenCalled();
  });

  it("検索内容が空なら400を返す", async () => {
    const res = await POST(
      createRequest({
        query: "   ",
        selectedTags: [],
        resultTagIds: ["tag-tech"],
      })
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "検索内容が空です" });
    expect(mockedQuery).not.toHaveBeenCalled();
    expect(mockedRecordSearchEvent).not.toHaveBeenCalled();
  });

  it("検索語がタグに一致したらconfidence 1で保存する", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: "tag-tech" }, { id: "tag-design" }],
    });

    const res = await POST(
      createRequest({
        query: " 設計 ",
        selectedTags: ["技術書"],
        resultTagIds: ["tag-novel"],
      })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual({ id: "search-event-1", tagCount: 2 });
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedQuery.mock.calls[0]?.[1]).toEqual([["技術書", "設計"]]);
    expect(mockedRecordSearchEvent).toHaveBeenCalledWith({
      userEmail: "user@example.com",
      query: "設計",
      searchType: "book_list",
      tagIds: ["tag-tech", "tag-design"],
      confidence: 1,
    });
  });

  it("検索語にタグがなければ検索結果タグ上位2件をconfidence 0.5で保存する", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const res = await POST(
      createRequest({
        query: "よくわからない検索",
        selectedTags: [],
        resultTagIds: [
          "tag-design",
          "tag-tech",
          "tag-design",
          "tag-novel",
          "tag-tech",
          "tag-design",
        ],
      })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual({ id: "search-event-1", tagCount: 2 });
    expect(mockedRecordSearchEvent).toHaveBeenCalledWith({
      userEmail: "user@example.com",
      query: "よくわからない検索",
      searchType: "book_list",
      tagIds: ["tag-design", "tag-tech"],
      confidence: 0.5,
    });
  });

  it("検索語にも検索結果にもタグがなければタグなしのconfidence 0.5で保存する", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const res = await POST(
      createRequest({
        query: "タグなし検索",
        selectedTags: [],
        resultTagIds: [],
      })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual({ id: "search-event-1", tagCount: 0 });
    expect(mockedRecordSearchEvent).toHaveBeenCalledWith({
      userEmail: "user@example.com",
      query: "タグなし検索",
      searchType: "book_list",
      tagIds: [],
      confidence: 0.5,
    });
  });
});
