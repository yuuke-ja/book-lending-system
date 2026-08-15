import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerPendingBooks } from "@/lib/action/admin/book-registration";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";
import { rebuildBookEmbeddings } from "@/app/api/admin/book-embeddings/book-embedding";
import { classifyBooks } from "@/lib/tags/classify-books";

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
vi.mock("@/lib/tags/classify-books", () => ({
  classifyBooks: vi.fn(),
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedAdmin = Admin as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;
const mockedTransaction = db.transaction as unknown as ReturnType<typeof vi.fn>;
const mockedRebuildBookEmbeddings =
  rebuildBookEmbeddings as unknown as ReturnType<typeof vi.fn>;
const mockedClassifyBooks = classifyBooks as unknown as ReturnType<typeof vi.fn>;

describe("registerPendingBooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRebuildBookEmbeddings.mockResolvedValue(1);
    mockedClassifyBooks.mockResolvedValue([]);
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const result = await registerPendingBooks();

    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("管理者以外のとき403を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedAdmin.mockResolvedValue(false);

    const result = await registerPendingBooks();

    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("登録した本のEmbedding作成後に自動タグ付けを実行する", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
    mockedQuery.mockResolvedValue({
      rows: [
        {
          googleBookId: "g1",
          isbn13: "9781234567890",
          title: "SQL入門",
          authors: ["著者A"],
          description: "データベースの解説書",
          thumbnail: "thumb",
        },
      ],
    });

    const txQuery = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: "book-1",
            title: "SQL入門",
            authors: ["著者A"],
            description: "データベースの解説書",
          },
        ],
      })
      .mockResolvedValue({ rows: [] });
    mockedTransaction.mockImplementation(
      async (callback: (tx: { query: typeof txQuery }) => Promise<unknown>) =>
        callback({ query: txQuery })
    );

    const result = await registerPendingBooks();

    expect(result).toMatchObject({ ok: true, status: 200 });
    expect(mockedRebuildBookEmbeddings).toHaveBeenCalledWith(["book-1"]);
    expect(mockedClassifyBooks).toHaveBeenCalledWith({ bookIds: ["book-1"] });
    expect(
      txQuery.mock.calls.some((call) =>
        String(call[0]).includes('DELETE FROM "PendingBook"')
      )
    ).toBe(true);
  });
});
