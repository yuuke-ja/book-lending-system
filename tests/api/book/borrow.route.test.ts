import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/book/borrow/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = vi.mocked(db.query);

function request(isbn13?: string) {
  const url = new URL("http://localhost/api/book/borrow");
  if (isbn13 !== undefined) url.searchParams.set("isbn13", isbn13);
  return new Request(url);
}

describe("GET /api/book/borrow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
  });

  it.each([null, { user: {} }])("有効なメール付きセッションがなければ401", async (session) => {
    mockedAuth.mockResolvedValue(session as never);

    const response = await GET(request("9781234567890"));

    expect(response.status).toBe(401);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "978123", "1234567890123", "978123456789X"])(
    "不正なISBN/JANなら400",
    async (isbn13) => {
      const response = await GET(request(isbn13));

      expect(response.status).toBe(400);
      expect(mockedQuery).not.toHaveBeenCalled();
    }
  );

  it.each(["9781234567890", "9791234567890", "4911234567890"])(
    "有効なISBN/JANで本を返す",
    async (isbn13) => {
      const book = { id: "book-1", isbn13, title: "本", authors: ["著者"] };
      mockedQuery.mockResolvedValueOnce({ rows: [book] } as never);

      const response = await GET(request(isbn13));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(book);
      expect(mockedQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE isbn13 = $1"), [isbn13]);
    }
  );

  it("登録されていない本なら404", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as never);

    const response = await GET(request("9781234567890"));

    expect(response.status).toBe(404);
  });

  it("DB障害なら500", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedQuery.mockRejectedValueOnce(new Error("database error"));

    const response = await GET(request("9781234567890"));

    expect(response.status).toBe(500);
    consoleError.mockRestore();
  });
});
