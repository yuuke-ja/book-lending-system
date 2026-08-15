import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTags } from "@/lib/action/admin/tag-list";
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

describe("createTags Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
  });

  it("複数タグをembeddingなしで保存する", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: "tag-1", tag: "Web", inserted: true }],
    });

    const result = await createTags(["Web", "SQL"]);

    expect(result.status).toBe(201);
    expect(result.ok).toBe(true);
    expect(String(mockedQuery.mock.calls[0][0])).toContain(
      'INSERT INTO "TagList" (tag)'
    );
    expect(String(mockedQuery.mock.calls[0][0])).not.toContain("embedding");
    expect(mockedQuery.mock.calls[0][1]).toEqual([["Web", "SQL"]]);
  });
});
