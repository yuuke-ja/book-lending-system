import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/book/search/full-text/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = vi.mocked(db.query);

function request(query?: string) {
  const url = new URL("http://localhost/api/book/search/full-text");
  if (query !== undefined) url.searchParams.set("query", query);
  return new Request(url);
}

describe("GET /api/book/search/full-text", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
  });

  it("未認証なら401を返してDBを読まない", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await GET(request("React"));

    expect(response.status).toBe(401);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "   "])("空の検索語なら空配列を返す", async (query) => {
    const response = await GET(request(query));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("検索語を分割・重複除去して先頭5語だけパラメータで渡す", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as never);

    await GET(request("React,SQL、React DB Go Rust TypeScript"));

    expect(mockedQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockedQuery.mock.calls[0];
    expect(String(sql)).toContain("pgroonga_score");
    expect(String(sql)).toContain("&@| $1::text[]");
    expect(params).toEqual([["React", "SQL", "DB", "Go", "Rust"]]);
    expect(String(sql)).not.toContain("TypeScript");
  });

  it("検索結果を200で返す", async () => {
    const rows = [{ id: "book-1", title: "React入門", tags: [] }];
    mockedQuery.mockResolvedValueOnce({ rows } as never);

    const response = await GET(request("React"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(rows);
  });

  it("DB検索に失敗したら500を返す", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedQuery.mockRejectedValueOnce(new Error("pgroonga unavailable"));

    const response = await GET(request("React"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "検索に失敗しました" });
    consoleError.mockRestore();
  });
});
