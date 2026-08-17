import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "pg";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/action/admin/require-admin";
import { rebuildBookEmbeddings } from "@/app/api/admin/book-embeddings/book-embedding";
import { classifyBooks } from "@/lib/tags/classify-books";
import { registerPendingBooks } from "@/lib/action/admin/book-registration";
import {
  connectIntegrationClient,
  createDatabaseAdapter,
  dropTempTables,
  getIntegrationDatabaseUrl,
  withTempTableSetup,
} from "./postgres-test-utils";

vi.mock("@/lib/db", () => ({
  db: { query: vi.fn(), transaction: vi.fn() },
}));
vi.mock("@/lib/action/admin/require-admin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/app/api/admin/book-embeddings/book-embedding", () => ({
  rebuildBookEmbeddings: vi.fn(),
}));
vi.mock("@/lib/tags/classify-books", () => ({ classifyBooks: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const databaseUrl = getIntegrationDatabaseUrl();
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const mockedQuery = vi.mocked(db.query);
const mockedTransaction = vi.mocked(db.transaction);
const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedRebuildBookEmbeddings = vi.mocked(rebuildBookEmbeddings);
const mockedClassifyBooks = vi.mocked(classifyBooks);

async function createTables(client: Client) {
  await dropTempTables(client, ["PendingBook", "Book"]);
  const columns = `
    id TEXT PRIMARY KEY,
    "googleBookId" TEXT,
    isbn13 TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    authors TEXT[] NOT NULL,
    description TEXT,
    thumbnail TEXT
  `;
  await client.query(`CREATE TEMP TABLE "Book" (${columns}, CHECK (title <> 'FAIL'))`);
  await client.query(`CREATE TEMP TABLE "PendingBook" (${columns})`);
}

describeWithDatabase("仮登録書籍の一括登録とPostgreSQL transactionの結合", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectIntegrationClient(databaseUrl!);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue({ ok: true });
    mockedRebuildBookEmbeddings.mockResolvedValue(2);
    mockedClassifyBooks.mockResolvedValue([]);
    const adapter = createDatabaseAdapter(client);
    mockedQuery.mockImplementation(adapter.query);
    mockedTransaction.mockImplementation(adapter.transaction);
    await withTempTableSetup(client, () => createTables(client));
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it("新規本を登録し、同じISBNは既存本を更新して仮登録一覧を空にする", async () => {
    await client.query(`
      INSERT INTO "Book"
        (id, "googleBookId", isbn13, title, authors, description, thumbnail)
      VALUES ('existing-id', 'old-google', '9780000000001', '更新前', ARRAY['旧著者'], '旧説明', NULL)
    `);
    await client.query(`
      INSERT INTO "PendingBook"
        (id, "googleBookId", isbn13, title, authors, description, thumbnail) VALUES
        ('pending-update', 'new-google', '9780000000001', '更新後', ARRAY['新著者'], '新説明', '/new.png'),
        ('pending-new', 'new-book-google', '9780000000002', '新規本', ARRAY['著者'], '説明', NULL)
    `);

    const result = await registerPendingBooks();

    expect(result).toMatchObject({ ok: true, status: 200, data: { embeddingCount: 2 } });
    const books = await client.query(
      `SELECT id, isbn13, title FROM "Book" ORDER BY isbn13`
    );
    const pending = await client.query(`SELECT id FROM "PendingBook"`);
    expect(books.rows).toHaveLength(2);
    expect(books.rows[0]).toEqual({
      id: "existing-id",
      isbn13: "9780000000001",
      title: "更新後",
    });
    expect(pending.rows).toEqual([]);
    const savedIds = books.rows.map((book) => book.id);
    expect(mockedRebuildBookEmbeddings).toHaveBeenCalledWith(
      expect.arrayContaining(savedIds)
    );
    expect(mockedClassifyBooks).toHaveBeenCalledWith({
      bookIds: expect.arrayContaining(savedIds),
    });
  });

  it("1冊の登録が失敗したら先に登録した本と仮登録削除をrollbackする", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await client.query(`
      INSERT INTO "PendingBook"
        (id, "googleBookId", isbn13, title, authors, description, thumbnail) VALUES
        ('pending-ok', NULL, '9780000000003', '成功予定', ARRAY['著者'], NULL, NULL),
        ('pending-fail', NULL, '9780000000004', 'FAIL', ARRAY['著者'], NULL, NULL)
    `);

    const result = await registerPendingBooks();

    expect(result).toMatchObject({ ok: false, status: 500 });
    const books = await client.query(`SELECT id FROM "Book"`);
    const pending = await client.query(`SELECT id FROM "PendingBook" ORDER BY id`);
    expect(books.rows).toEqual([]);
    expect(pending.rows.map((row) => row.id)).toEqual(["pending-fail", "pending-ok"]);
    expect(mockedRebuildBookEmbeddings).not.toHaveBeenCalled();
    expect(mockedClassifyBooks).not.toHaveBeenCalled();
  });
});
