import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/book/review/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

describe("/api/book/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET: bookIdがないとき400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const res = await GET(new Request("http://localhost/api/book/review"));

    expect(res.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

});
