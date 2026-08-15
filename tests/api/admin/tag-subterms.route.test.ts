import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTagSubterms } from "@/lib/action/admin/tag-subterms";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/admin", () => ({ Admin: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/api/admin/book-embeddings/book-embedding", () => ({
  rebuildBookEmbeddings: vi.fn(),
}));
vi.mock("@/lib/tags/classify-books", () => ({ classifyBooks: vi.fn() }));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedAdmin = Admin as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

describe("createTagSubterms Server Action", () => {
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

    const result = await createTagSubterms("tag-1", ["SQL", "DB"]);

    expect(result.status).toBe(201);
    expect(result.ok).toBe(true);
    expect(String(mockedQuery.mock.calls[0][0])).toContain(
      'INSERT INTO "TagSubterm" ("tagId", subterm)'
    );
    expect(String(mockedQuery.mock.calls[0][0])).not.toContain("embedding");
    expect(mockedQuery.mock.calls[0][1]).toEqual(["tag-1", ["SQL", "DB"]]);
  });
});
