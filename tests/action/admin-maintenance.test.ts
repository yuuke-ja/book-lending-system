import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMissingEmbeddings,
  rebuildAllEmbeddings,
  runEmbeddingTest,
} from "@/lib/action/admin/book-embeddings";
import {
  classifyAllBooks,
  classifyBooksForTag,
} from "@/lib/action/admin/tag-classification";
import { Admin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createMissingBookEmbeddings,
  rebuildBookEmbeddings,
} from "@/app/api/admin/book-embeddings/book-embedding";
import { testBookEmbeddings } from "@/lib/ai/embedding-test";
import { classifyBooks } from "@/lib/tags/classify-books";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/admin", () => ({ Admin: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { query: vi.fn(), transaction: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/api/admin/book-embeddings/book-embedding", () => ({
  createMissingBookEmbeddings: vi.fn(),
  rebuildBookEmbeddings: vi.fn(),
}));
vi.mock("@/lib/ai/embedding-test", () => ({
  testBookEmbeddings: vi.fn(),
}));
vi.mock("@/lib/tags/classify-books", () => ({
  classifyBooks: vi.fn(),
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedAdmin = Admin as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;
const mockedCreateMissing =
  createMissingBookEmbeddings as unknown as ReturnType<typeof vi.fn>;
const mockedRebuild = rebuildBookEmbeddings as unknown as ReturnType<typeof vi.fn>;
const mockedTest = testBookEmbeddings as unknown as ReturnType<typeof vi.fn>;
const mockedClassify = classifyBooks as unknown as ReturnType<typeof vi.fn>;

describe("管理メンテナンスAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
  });

  it("未ログインならEmbedding処理を実行しない", async () => {
    mockedAuth.mockResolvedValue(null);

    const result = await createMissingEmbeddings();

    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(mockedCreateMissing).not.toHaveBeenCalled();
  });

  it("不足分のEmbeddingを生成する", async () => {
    mockedCreateMissing.mockResolvedValue(3);

    const result = await createMissingEmbeddings();

    expect(result).toMatchObject({ ok: true, data: { count: 3 } });
  });

  it("全ての本のEmbeddingを再構築する", async () => {
    mockedQuery.mockResolvedValue({ rows: [{ id: "book-1" }, { id: "book-2" }] });
    mockedRebuild.mockResolvedValue(2);

    const result = await rebuildAllEmbeddings();

    expect(result).toMatchObject({ ok: true, data: { count: 2 } });
    expect(mockedRebuild).toHaveBeenCalledWith(["book-1", "book-2"]);
  });

  it("Embeddingテストの表示件数を検証する", async () => {
    const result = await runEmbeddingTest({ mode: "query", query: "web", limit: 51 });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(mockedTest).not.toHaveBeenCalled();
  });

  it("Embeddingテスト結果を返す", async () => {
    mockedTest.mockResolvedValue([]);

    const result = await runEmbeddingTest({ mode: "query", query: "web", limit: 10 });

    expect(result).toMatchObject({
      ok: true,
      data: { mode: "query", results: [] },
    });
  });

  it("全ての本をタグ分類する", async () => {
    mockedClassify.mockResolvedValue([{ bookId: "book-1" }]);

    const result = await classifyAllBooks();

    expect(result).toMatchObject({ ok: true, data: { count: 1 } });
    expect(mockedClassify).toHaveBeenCalledWith();
  });

  it("指定タグだけで本を分類する", async () => {
    mockedClassify.mockResolvedValue([]);

    const result = await classifyBooksForTag("tag-1");

    expect(result).toMatchObject({ ok: true, data: { count: 0 } });
    expect(mockedClassify).toHaveBeenCalledWith({ tagIds: ["tag-1"] });
  });
});
