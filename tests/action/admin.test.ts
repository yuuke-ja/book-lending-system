import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateBookInfo } from "@/lib/action/admin/book-info";
import { updateBookTags } from "@/lib/action/admin/book-tags";
import { saveLoanSettings } from "@/lib/action/admin/loan-settings";
import { createNotice, deleteNotice } from "@/lib/action/admin/notices";
import {
  createPendingBook,
  deletePendingBook,
} from "@/lib/action/admin/pending-books";
import { deleteTag } from "@/lib/action/admin/tag-list";
import { deleteTagSubterm } from "@/lib/action/admin/tag-subterms";
import { rebuildBookEmbeddings } from "@/app/api/admin/book-embeddings/book-embedding";
import { Admin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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
vi.mock("@/lib/tags/classify-books", () => ({ classifyBooks: vi.fn() }));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedAdmin = Admin as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;
const mockedTransaction = db.transaction as unknown as ReturnType<typeof vi.fn>;
const mockedRebuildBookEmbeddings =
  rebuildBookEmbeddings as unknown as ReturnType<typeof vi.fn>;
const mockedClassifyBooks = classifyBooks as unknown as ReturnType<typeof vi.fn>;

describe("admin Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
    mockedRebuildBookEmbeddings.mockResolvedValue(1);
    mockedClassifyBooks.mockResolvedValue([]);
  });

  it("未ログインなら401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const result = await deleteNotice("notice-1");

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "認証が必要です",
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("管理者でなければ403を返す", async () => {
    mockedAdmin.mockResolvedValue(false);

    const result = await deletePendingBook("pending-1");

    expect(result.status).toBe(403);
    expect(result.ok).toBe(false);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("貸出設定をトランザクションで保存する", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: "settings-1" }] });
    const txQuery = vi.fn().mockResolvedValue({ rows: [] });
    mockedTransaction.mockImplementation(
      async (callback: (tx: { query: typeof txQuery }) => Promise<unknown>) =>
        callback({ query: txQuery })
    );

    const result = await saveLoanSettings({
      fridayOnly: true,
      returnweek: 2,
      exceptionRules: [
        {
          startDate: "2030-01-01",
          endDate: "2030-01-03",
          loanPeriodDays: 3,
        },
      ],
    });

    expect(result).toMatchObject({ ok: true, status: 200 });
    expect(txQuery).toHaveBeenCalledTimes(3);
    expect(txQuery.mock.calls[0][1]).toEqual([true, 2, "settings-1"]);
    expect(String(txQuery.mock.calls[2][0])).toContain(
      'INSERT INTO "LoanOpenPeriod"'
    );
  });

  it("お知らせの入力を検証する", async () => {
    const result = await createNotice({ title: "", content: { type: "doc" } });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "タイトルを入力してください",
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("お知らせを作成する", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "notice-1",
          title: "お知らせ",
          content: { type: "doc", content: [] },
          bookId: null,
          createdAt: "2030-01-01T00:00:00.000Z",
        },
      ],
    });

    const result = await createNotice({
      title: " お知らせ ",
      content: { type: "doc", content: [] },
      bookId: null,
    });

    expect(result).toMatchObject({ ok: true, status: 201 });
    expect(mockedQuery.mock.calls[0][1]).toEqual([
      "お知らせ",
      JSON.stringify({ type: "doc", content: [] }),
      null,
    ]);
  });

  it("存在しないお知らせの削除は404を返す", async () => {
    mockedQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const result = await deleteNotice("notice-missing");

    expect(result.status).toBe(404);
    expect(result.ok).toBe(false);
  });

  it("本情報更新後にembeddingと自動タグ付けを更新する", async () => {
    mockedQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const result = await updateBookInfo({
      bookId: "book-1",
      title: " SQL入門 ",
      description: "説明",
    });

    expect(result).toMatchObject({ ok: true, status: 200 });
    expect(mockedQuery.mock.calls[0][1]).toEqual(["SQL入門", "説明", "book-1"]);
    expect(mockedRebuildBookEmbeddings).toHaveBeenCalledWith(["book-1"]);
    expect(mockedClassifyBooks).toHaveBeenCalledWith({ bookIds: ["book-1"] });
  });

  it("本のタグをトランザクションで置き換える", async () => {
    const txQuery = vi.fn().mockResolvedValue({ rows: [] });
    mockedTransaction.mockImplementation(
      async (callback: (tx: { query: typeof txQuery }) => Promise<unknown>) =>
        callback({ query: txQuery })
    );

    const result = await updateBookTags({
      bookId: "book-1",
      tags: ["tag-1", "tag-1", "tag-2"],
    });

    expect(result).toMatchObject({ ok: true, status: 200 });
    expect(txQuery).toHaveBeenCalledTimes(2);
    expect(txQuery.mock.calls[1][1]).toEqual([
      "book-1",
      ["tag-1", "tag-2"],
    ]);
    expect(mockedRebuildBookEmbeddings).toHaveBeenCalledWith(["book-1"]);
  });

  it("タグを削除する", async () => {
    mockedQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const result = await deleteTag("tag-1");

    expect(result).toEqual({
      ok: true,
      status: 200,
      message: "タグを削除しました",
    });
    expect(mockedQuery.mock.calls[0][1]).toEqual(["tag-1"]);
  });

  it("小要素をタグとの組み合わせで削除する", async () => {
    mockedQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const result = await deleteTagSubterm("tag-1", "subterm-1");

    expect(result).toEqual({
      ok: true,
      status: 200,
      message: "小要素を削除しました",
    });
    expect(mockedQuery.mock.calls[0][1]).toEqual(["subterm-1", "tag-1"]);
  });

  it("登録待ち書籍を追加して作成データを返す", async () => {
    const pendingBook = {
      id: "pending-1",
      googleBookId: "google-1",
      isbn13: "9781234567890",
      title: "SQL入門",
      authors: ["著者"],
      description: "説明",
      thumbnail: null,
    };
    mockedQuery
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [pendingBook] });

    const result = await createPendingBook(pendingBook);

    expect(result).toMatchObject({
      ok: true,
      status: 201,
      data: pendingBook,
    });
  });

  it("存在しない登録待ち書籍の削除は404を返す", async () => {
    mockedQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const result = await deletePendingBook("pending-missing");

    expect(result.status).toBe(404);
    expect(result.ok).toBe(false);
  });
});
