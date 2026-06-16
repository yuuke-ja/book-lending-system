import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/admin/genre-points/route";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/admin", () => ({ Admin: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
  },
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedAdmin = Admin as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

function createRequest(query = "") {
  return new Request(`http://localhost/api/admin/genre-points${query}`);
}

describe("GET /api/admin/genre-points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const res = await GET(createRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "認証が必要です" });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("管理者以外は403を返す", async () => {
    mockedAdmin.mockResolvedValue(false);

    const res = await GET(createRequest());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("ポイントが0未満なら400を返す", async () => {
    const res = await GET(createRequest("?loan=-1"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "ポイントは0以上の数値で指定してください",
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("ポイントが数値でなければ400を返す", async () => {
    const res = await GET(createRequest("?searchBookList=abc"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "ポイントは0以上の数値で指定してください",
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("デフォルト重みで月別タグ別ポイントを返す", async () => {
    const dbRows = [
      {
        month: new Date("2026-04-01T00:00:00.000Z"),
        tagId: "tag-design",
        tagName: "デザイン",
        points: 17.8,
      },
      {
        month: new Date("2026-05-01T00:00:00.000Z"),
        tagId: "tag-tech",
        tagName: "技術書",
        points: 16.5,
      },
      {
        month: new Date("2026-06-01T00:00:00.000Z"),
        tagId: "tag-novel",
        tagName: "小説",
        points: 5.75,
      },
      {
        month: new Date("2026-06-01T00:00:00.000Z"),
        tagId: "tag-tech",
        tagName: "技術書",
        points: 10.5,
      },
      {
        month: new Date("2026-06-01T00:00:00.000Z"),
        tagId: "tag-design",
        tagName: "デザイン",
        points: 10.5,
      },
      {
        month: new Date("2026-07-01T00:00:00.000Z"),
        tagId: "tag-history",
        tagName: "歴史",
        points: 19.1,
      },
    ];
    const expectedRows = [
      {
        month: "2026-04-01T00:00:00.000Z",
        tagId: "tag-design",
        tagName: "デザイン",
        points: 17.8,
      },
      {
        month: "2026-05-01T00:00:00.000Z",
        tagId: "tag-tech",
        tagName: "技術書",
        points: 16.5,
      },
      {
        month: "2026-06-01T00:00:00.000Z",
        tagId: "tag-novel",
        tagName: "小説",
        points: 5.75,
      },
      {
        month: "2026-06-01T00:00:00.000Z",
        tagId: "tag-tech",
        tagName: "技術書",
        points: 10.5,
      },
      {
        month: "2026-06-01T00:00:00.000Z",
        tagId: "tag-design",
        tagName: "デザイン",
        points: 10.5,
      },
      {
        month: "2026-07-01T00:00:00.000Z",
        tagId: "tag-history",
        tagName: "歴史",
        points: 19.1,
      },
    ];
    mockedQuery.mockResolvedValueOnce({ rows: dbRows });

    const res = await GET(createRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.weights).toEqual({
      searchBookList: 1,
      searchAiQuery: 1,
      loan: 10,
      bookDetailView: 0.5,
      postView: 0.5,
      threadBookLinkClick: 2,
      commentBookLinkClick: 2,
      aiBookLinkClick: 2,
      aiRecommendationView: 0.5,
      threadCreate: 3,
      commentCreate: 1,
    });
    expect(data.rows).toEqual(expectedRows);
    expect(data.rows).toHaveLength(6);
    expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), [
      1,
      1,
      10,
      0.5,
      0.5,
      2,
      2,
      2,
      0.5,
      3,
      1,
    ]);
  });

  it("クエリパラメータで重みを変更できる", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      createRequest(
        "?searchBookList=2" +
          "&searchAiQuery=3" +
          "&loan=4" +
          "&bookDetailView=5" +
          "&postView=6" +
          "&threadBookLinkClick=7" +
          "&commentBookLinkClick=8" +
          "&aiBookLinkClick=9" +
          "&aiRecommendationView=10" +
          "&threadCreate=11" +
          "&commentCreate=12"
      )
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.weights).toEqual({
      searchBookList: 2,
      searchAiQuery: 3,
      loan: 4,
      bookDetailView: 5,
      postView: 6,
      threadBookLinkClick: 7,
      commentBookLinkClick: 8,
      aiBookLinkClick: 9,
      aiRecommendationView: 10,
      threadCreate: 11,
      commentCreate: 12,
    });
    expect(data.rows).toEqual([]);
    expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), [
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
    ]);
  });
});
