import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/book/search/tag/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = vi.mocked(db.query);

function request(values: string[] = []) {
  const url = new URL("http://localhost/api/book/search/tag");
  for (const value of values) url.searchParams.append("tagIds", value);
  return new Request(url);
}

describe("GET /api/book/search/tag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
  });

  it("未認証なら401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await GET(request(["tag-1"]));

    expect(response.status).toBe(401);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("tagIdsがなければ空配列を返す", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("タグ名のqueryは検索条件に使わず、極端に長くてもDBへ渡さない", async () => {
    const url = new URL("http://localhost/api/book/search/tag");
    url.searchParams.set("query", `React${"x".repeat(10_000)}`);

    const response = await GET(new Request(url));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("繰り返し・カンマ区切りのtagIdsを整形してIDで検索する", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as never);

    await GET(request([" tag-1,tag-2 ", "tag-1", ""]));

    const [sql, params] = mockedQuery.mock.calls[0];
    expect(String(sql)).toContain('bt."tagId" = ANY($1::text[])');
    expect(String(sql)).not.toContain("lower(t.tag)");
    expect(params).toEqual([["tag-1", "tag-2"]]);
  });

  it("タグIDに一致した本を200で返す", async () => {
    const rows = [{ id: "book-1", title: "SQL入門", tags: [{ id: "tag-db", tag: "DB" }] }];
    mockedQuery.mockResolvedValueOnce({ rows } as never);

    const response = await GET(request(["tag-db"]));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(rows);
  });

  it("DB検索に失敗したら500を返す", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedQuery.mockRejectedValueOnce(new Error("database error"));

    const response = await GET(request(["tag-db"]));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "検索に失敗しました" });
    consoleError.mockRestore();
  });
});
