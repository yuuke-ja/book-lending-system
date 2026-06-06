import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/tags/[tagId]/subterms/route";
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

describe("POST /api/admin/tags/[tagId]/subterms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
  });

  it("複数小要素をembeddingなしで保存する", async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: "subterm-1", tagId: "tag-1", subterm: "SQL" }],
      });

    const res = await POST(
      new Request("http://localhost/api/admin/tags/tag-1/subterms", {
        method: "POST",
        body: JSON.stringify({ subterms: ["SQL", "DB"] }),
      }),
      { params: Promise.resolve({ tagId: "tag-1" }) }
    );

    expect(res.status).toBe(201);
    expect(String(mockedQuery.mock.calls[0][0])).toContain(
      'INSERT INTO "TagSubterm" ("tagId", subterm)'
    );
    expect(String(mockedQuery.mock.calls[0][0])).not.toContain("embedding");
    expect(mockedQuery.mock.calls[0][1]).toEqual(["tag-1", ["SQL", "DB"]]);
  });
});
