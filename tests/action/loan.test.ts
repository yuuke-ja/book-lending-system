import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { loanBook } from "@/lib/action/loan";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;
const mockedTransaction = db.transaction as unknown as ReturnType<typeof vi.fn>;

function mockSettingsQuery() {
  mockedQuery.mockResolvedValueOnce({
    rows: [{ id: "settings-1", fridayOnly: true, loanPeriodDays: 2 }],
  });
}

function mockOpenPeriodByNowRange(start: Date, end: Date) {
  mockedQuery.mockImplementationOnce(async (_sql: string, params?: unknown[]) => {
    const now = params?.[1];
    if (!(now instanceof Date)) return { rows: [] };
    const inRange = now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
    if (!inRange) return { rows: [] };
    return {
      rows: [{ id: "open-period-1", loanPeriodDays: 7, endDate: end }],
    };
  });
}

function mockBorrowSuccessTail() {
  mockedQuery.mockResolvedValueOnce({ rows: [{ id: "book-1" }] });
  mockedQuery.mockResolvedValueOnce({ rows: [] });
  mockedQuery.mockResolvedValueOnce({});
}

describe("loanBook Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T12:00:00.000+09:00"));
    mockedTransaction.mockImplementation(async (callback) =>
      callback({ query: mockedQuery })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("未ログインのとき認証エラーを返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const result = await loanBook("book-1");

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "認証が必要です",
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("bookIdが不正なときDBへアクセスせず入力エラーを返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const result = await loanBook(null);

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "bookIdが不正です",
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("貸出停止中は曜日や例外期間を確認せず貸出を拒否する", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "settings-1",
          loanEnabled: false,
          fridayOnly: true,
          loanPeriodDays: 2,
        },
      ],
    });

    const result = await loanBook("book-1");

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "現在は貸出を停止しています",
    });
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it.each([
    {
      caseName: "例外期間の1日前（非金曜）は借りられない",
      now: "2026-03-08T12:00:00.000+09:00",
      expectedOk: false,
      expectedStatus: 403,
      expectedQueryCount: 2,
      expectedInPeriod: false,
    },
    {
      caseName: "例外期間の開始日（非金曜）は借りられる",
      now: "2026-03-09T12:00:00.000+09:00",
      expectedOk: true,
      expectedStatus: 200,
      expectedQueryCount: 6,
      expectedInPeriod: true,
    },
    {
      caseName: "例外期間の期間中（非金曜）は借りられる",
      now: "2026-03-10T12:00:00.000+09:00",
      expectedOk: true,
      expectedStatus: 200,
      expectedQueryCount: 6,
      expectedInPeriod: true,
    },
    {
      caseName: "例外期間の終了日（非金曜）は借りられる",
      now: "2026-03-11T12:00:00.000+09:00",
      expectedOk: true,
      expectedStatus: 200,
      expectedQueryCount: 6,
      expectedInPeriod: true,
    },
    {
      caseName: "例外期間の1日後（非金曜）は借りられない",
      now: "2026-03-12T12:00:00.000+09:00",
      expectedOk: false,
      expectedStatus: 403,
      expectedQueryCount: 2,
      expectedInPeriod: false,
    },
  ])("$caseName", async (scenario) => {
    const exceptionStart = new Date("2026-03-09T00:00:00.000+09:00");
    const exceptionEnd = new Date("2026-03-11T23:59:59.999+09:00");

    vi.setSystemTime(new Date(scenario.now));
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    mockSettingsQuery();
    mockOpenPeriodByNowRange(exceptionStart, exceptionEnd);
    if (scenario.expectedOk) {
      mockBorrowSuccessTail();
    }

    const result = await loanBook("book-1");

    expect(result.ok).toBe(scenario.expectedOk);
    expect(result.status).toBe(scenario.expectedStatus);
    expect(mockedQuery).toHaveBeenCalledTimes(scenario.expectedQueryCount);
    expect(mockedTransaction).toHaveBeenCalledTimes(
      scenario.expectedOk ? 1 : 0
    );

    if (scenario.expectedInPeriod) {
      const insertParams = mockedQuery.mock.calls[4]?.[1] as unknown[] | undefined;
      const dueAt = insertParams?.[3];
      expect(dueAt).toBeInstanceOf(Date);
      expect((dueAt as Date).toISOString()).toBe(exceptionEnd.toISOString());
    }
  });

  it("金曜日は例外期間外でも借りられる", async () => {
    vi.setSystemTime(new Date("2026-03-06T12:00:00.000+09:00"));
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    mockSettingsQuery();
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockBorrowSuccessTail();

    const result = await loanBook("book-1");

    expect(result).toEqual({
      ok: true,
      status: 200,
      message: "貸出が完了しました",
    });
    expect(mockedQuery).toHaveBeenCalledTimes(6);
    expect(mockedTransaction).toHaveBeenCalledTimes(1);
    expect(mockedRevalidatePath.mock.calls).toEqual([
      ["/"],
      ["/book-list"],
    ]);
  });

  it("fridayOnlyがfalseなら非金曜・例外期間外でも借りられる", async () => {
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000+09:00"));
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: "settings-1", fridayOnly: false, loanPeriodDays: 2 }],
    });
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockBorrowSuccessTail();

    const result = await loanBook("book-1");

    expect(result).toEqual({
      ok: true,
      status: 200,
      message: "貸出が完了しました",
    });
    expect(mockedQuery).toHaveBeenCalledTimes(6);
    expect(mockedTransaction).toHaveBeenCalledTimes(1);
  });

  it("貸出設定が未作成なら非金曜は借りられない", async () => {
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000+09:00"));
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const result = await loanBook("book-1");

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "貸出は金曜日のみ可能です",
    });
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it("すでに貸出中なら重複登録しない", async () => {
    vi.setSystemTime(new Date("2026-03-06T12:00:00.000+09:00"));
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockSettingsQuery();
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: "book-1" }] });
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: "loan-1" }] });

    const result = await loanBook("book-1");

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "この本はすでに貸出中です",
    });
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it("本が存在しないとき404を返す", async () => {
    vi.setSystemTime(new Date("2026-03-06T12:00:00.000+09:00"));
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockSettingsQuery();
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const result = await loanBook("missing-book");

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: "本が見つかりません",
    });
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it("DB処理に失敗したとき500を返す", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockRejectedValueOnce(new Error("database error"));

    const result = await loanBook("book-1");

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: "貸出に失敗しました",
    });
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
