import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateRecommendations } from "@/lib/Recommended/generate-recommendations";
import { findTagCandidatesFromHistory } from "@/lib/Recommended/tag-candidates-from-history";
import { findTagCandidatesFromSearchHistory } from "@/lib/Recommended/tag-candidates-from-search-history";
import { findCandidatesFromHistory } from "@/lib/Recommended/vector-candidates-from-history";
import { findCandidatesFromSearchHistory } from "@/lib/Recommended/vector-candidates-from-search-history";
import { db } from "@/lib/db";

const { dbTransactionMock, txQueryMock } = vi.hoisted(() => {
  const txQueryMock = vi.fn();
  const dbTransactionMock = vi.fn(async (callback) =>
    callback({ query: txQueryMock })
  );

  return { dbTransactionMock, txQueryMock };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    transaction: dbTransactionMock,
  },
}));

vi.mock("@/lib/Recommended/vector-candidates-from-history", () => ({
  findCandidatesFromHistory: vi.fn(),
}));

vi.mock("@/lib/Recommended/vector-candidates-from-search-history", () => ({
  findCandidatesFromSearchHistory: vi.fn(),
}));

vi.mock("@/lib/Recommended/tag-candidates-from-history", () => ({
  findTagCandidatesFromHistory: vi.fn(),
}));

vi.mock("@/lib/Recommended/tag-candidates-from-search-history", () => ({
  findTagCandidatesFromSearchHistory: vi.fn(),
}));

const mockedFindCandidatesFromHistory = vi.mocked(findCandidatesFromHistory);
const mockedFindCandidatesFromSearchHistory = vi.mocked(
  findCandidatesFromSearchHistory
);
const mockedFindTagCandidatesFromHistory = vi.mocked(findTagCandidatesFromHistory);
const mockedFindTagCandidatesFromSearchHistory = vi.mocked(
  findTagCandidatesFromSearchHistory
);
const mockedDb = vi.mocked(db);

describe("generateRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFindTagCandidatesFromHistory.mockResolvedValue([]);
    mockedFindTagCandidatesFromSearchHistory.mockResolvedValue([]);
  });

  it("候補回数、新しさ、距離の各順位点を合算して候補を並べる", async () => {
    mockedFindCandidatesFromHistory.mockResolvedValue([
      {
        historyBookId: "source-new",
        occurredAt: new Date("2026-06-23T10:00:00+09:00"),
        bookId: "candidate-a",
        distance: 0.2,
      },
      {
        historyBookId: "source-new",
        occurredAt: new Date("2026-06-23T10:00:00+09:00"),
        bookId: "candidate-b",
        distance: 0.1,
      },
      {
        historyBookId: "source-old",
        occurredAt: new Date("2026-06-22T10:00:00+09:00"),
        bookId: "candidate-a",
        distance: 0.15,
      },
      {
        historyBookId: "source-old",
        occurredAt: new Date("2026-06-22T10:00:00+09:00"),
        bookId: "candidate-c",
        distance: 0.05,
      },
    ]);
    mockedFindCandidatesFromSearchHistory.mockResolvedValue([
      {
        sourceQuery: "React",
        occurredAt: new Date("2026-06-24T10:00:00+09:00"),
        bookId: "candidate-d",
        distance: 0.12,
      },
    ]);

    const result = await generateRecommendations("user@example.com");

    expect(mockedFindCandidatesFromHistory).toHaveBeenCalledOnce();
    expect(mockedFindCandidatesFromHistory).toHaveBeenCalledWith(
      "user@example.com"
    );
    expect(mockedFindCandidatesFromSearchHistory).toHaveBeenCalledOnce();
    expect(mockedFindCandidatesFromSearchHistory).toHaveBeenCalledWith(
      "user@example.com"
    );
    expect(mockedFindTagCandidatesFromHistory).toHaveBeenCalledOnce();
    expect(mockedFindTagCandidatesFromHistory).toHaveBeenCalledWith(
      "user@example.com"
    );
    expect(result.map((candidate) => candidate.bookId)).toEqual([
      "candidate-d",
      "candidate-a",
      "candidate-b",
      "candidate-c",
    ]);
    expect(result[0]).toMatchObject({
      recommendBookCount: 1,
      recommendBookDistance: 0.12,
    });
    expect(mockedDb.transaction).toHaveBeenCalledOnce();
    expect(txQueryMock).toHaveBeenCalledTimes(3);
    expect(txQueryMock.mock.calls[0][0]).toContain(
      "SELECT pg_advisory_xact_lock(hashtext($1))"
    );
    expect(txQueryMock.mock.calls[0][1]).toEqual(["user@example.com"]);
    expect(txQueryMock.mock.calls[1][0]).toContain(
      'DELETE FROM "UserRecommendation"'
    );
    expect(txQueryMock.mock.calls[2][0]).toContain(
      'INSERT INTO "UserRecommendation"'
    );
    expect(txQueryMock.mock.calls[2][1]).toEqual([
      "user@example.com",
      ["candidate-d", "candidate-a", "candidate-b", "candidate-c"],
      [1, 2, 3, 4],
      [1, 2, 1, 1],
      [0.12, 0.15, 0.1, 0.05],
      [
        new Date("2026-06-24T10:00:00+09:00"),
        new Date("2026-06-23T10:00:00+09:00"),
        new Date("2026-06-23T10:00:00+09:00"),
        new Date("2026-06-22T10:00:00+09:00"),
      ],
    ]);
  });

  it("履歴がなければ空配列を返す", async () => {
    mockedFindCandidatesFromHistory.mockResolvedValue([]);
    mockedFindCandidatesFromSearchHistory.mockResolvedValue([]);

    await expect(
      generateRecommendations("user@example.com")
    ).resolves.toEqual([]);
    expect(mockedFindCandidatesFromHistory).toHaveBeenCalledOnce();
    expect(mockedFindCandidatesFromSearchHistory).toHaveBeenCalledOnce();
    expect(mockedFindTagCandidatesFromHistory).toHaveBeenCalledOnce();
    expect(mockedDb.transaction).toHaveBeenCalledOnce();
    expect(txQueryMock).toHaveBeenCalledTimes(2);
    expect(txQueryMock.mock.calls[0][0]).toContain(
      "SELECT pg_advisory_xact_lock(hashtext($1))"
    );
    expect(txQueryMock.mock.calls[0][1]).toEqual(["user@example.com"]);
    expect(txQueryMock.mock.calls[1][0]).toContain(
      'DELETE FROM "UserRecommendation"'
    );
  });

  it("検索履歴候補の取得に失敗しても行動ログ候補とジャンル候補でおすすめを作る", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockedFindCandidatesFromHistory.mockResolvedValue([
      {
        historyBookId: "source-book",
        occurredAt: new Date("2026-06-24T10:00:00+09:00"),
        bookId: "candidate-vector",
        distance: 0.2,
      },
    ]);
    mockedFindCandidatesFromSearchHistory.mockRejectedValue(
      new Error("embedding failed")
    );
    mockedFindTagCandidatesFromHistory.mockResolvedValue([
      {
        historyBookId: "source-book",
        occurredAt: new Date("2026-06-25T10:00:00+09:00"),
        bookId: "candidate-tag",
      },
    ]);

    const result = await generateRecommendations("user@example.com");

    expect(result.map((recommendBook) => recommendBook.bookId)).toEqual([
      "candidate-vector",
      "candidate-tag",
    ]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "検索履歴からのおすすめ候補取得に失敗:",
      expect.any(Error)
    );
    expect(txQueryMock).toHaveBeenCalledTimes(3);
    expect(txQueryMock.mock.calls[0][0]).toContain(
      "SELECT pg_advisory_xact_lock(hashtext($1))"
    );

    consoleErrorSpy.mockRestore();
  });

  it("行動ログ候補の取得に失敗したら呼び出し元へ例外を返す", async () => {
    mockedFindCandidatesFromHistory.mockRejectedValue(
      new Error("research event query failed")
    );

    await expect(generateRecommendations("user@example.com")).rejects.toThrow(
      "research event query failed"
    );
    expect(mockedFindCandidatesFromSearchHistory).not.toHaveBeenCalled();
    expect(mockedFindTagCandidatesFromHistory).not.toHaveBeenCalled();
    expect(mockedDb.transaction).not.toHaveBeenCalled();
  });

  it("ジャンル候補2系統を並列に取得する", async () => {
    const calls: string[] = [];
    let resolveHistoryTag: ((value: []) => void) | undefined;
    let resolveSearchTag: ((value: []) => void) | undefined;

    mockedFindCandidatesFromHistory.mockResolvedValue([]);
    mockedFindCandidatesFromSearchHistory.mockResolvedValue([]);
    mockedFindTagCandidatesFromHistory.mockImplementation(
      () =>
        new Promise<[]>((resolve) => {
          calls.push("history-tag:start");
          resolveHistoryTag = resolve;
        }).then((result) => {
          calls.push("history-tag:end");
          return result;
        })
    );
    mockedFindTagCandidatesFromSearchHistory.mockImplementation(
      () =>
        new Promise<[]>((resolve) => {
          calls.push("search-tag:start");
          resolveSearchTag = resolve;
        }).then((result) => {
          calls.push("search-tag:end");
          return result;
        })
    );

    const recommendations = generateRecommendations("user@example.com");

    await vi.waitFor(() => {
      expect(calls).toEqual(["history-tag:start", "search-tag:start"]);
    });

    resolveHistoryTag?.([]);
    resolveSearchTag?.([]);
    await recommendations;

    expect(calls).toEqual([
      "history-tag:start",
      "search-tag:start",
      "history-tag:end",
      "search-tag:end",
    ]);
  });

  it("ベクトル候補とジャンル候補をbookIdで合算して順位を決める", async () => {
    mockedFindCandidatesFromHistory.mockResolvedValue([
      {
        historyBookId: "source-vector",
        occurredAt: new Date("2026-06-26T10:00:00+09:00"),
        bookId: "candidate-vector-only",
        distance: 0.1,
      },
      {
        historyBookId: "source-both",
        occurredAt: new Date("2026-06-24T10:00:00+09:00"),
        bookId: "candidate-both",
        distance: 0.9,
      },
    ]);
    mockedFindCandidatesFromSearchHistory.mockResolvedValue([]);
    mockedFindTagCandidatesFromHistory.mockResolvedValue([
      {
        historyBookId: "source-tag",
        occurredAt: new Date("2026-06-27T10:00:00+09:00"),
        bookId: "candidate-both",
      },
      {
        historyBookId: "source-tag",
        occurredAt: new Date("2026-06-25T10:00:00+09:00"),
        bookId: "candidate-tag-only",
      },
    ]);

    const result = await generateRecommendations("user@example.com");

    expect(result.map((recommendBook) => recommendBook.bookId)).toEqual([
      "candidate-both",
      "candidate-vector-only",
      "candidate-tag-only",
    ]);
    expect(txQueryMock.mock.calls[2][1]).toEqual([
      "user@example.com",
      ["candidate-both", "candidate-vector-only", "candidate-tag-only"],
      [1, 2, 3],
      [2, 1, 1],
      [0.9, 0.1, 1],
      [
        new Date("2026-06-27T10:00:00+09:00"),
        new Date("2026-06-26T10:00:00+09:00"),
        new Date("2026-06-25T10:00:00+09:00"),
      ],
    ]);
  });

  it("点数合計で上位8冊だけ保存する", async () => {
    mockedFindCandidatesFromHistory.mockResolvedValue([
      {
        historyBookId: "source",
        occurredAt: new Date("2026-06-29T10:00:00+09:00"),
        bookId: "candidate-a",
        distance: 0.9,
      },
      {
        historyBookId: "source",
        occurredAt: new Date("2026-06-28T10:00:00+09:00"),
        bookId: "candidate-b",
        distance: 0.8,
      },
      {
        historyBookId: "source",
        occurredAt: new Date("2026-06-27T10:00:00+09:00"),
        bookId: "candidate-c",
        distance: 0.7,
      },
      {
        historyBookId: "source",
        occurredAt: new Date("2026-06-26T10:00:00+09:00"),
        bookId: "candidate-d",
        distance: 0.6,
      },
      {
        historyBookId: "source",
        occurredAt: new Date("2026-06-25T10:00:00+09:00"),
        bookId: "candidate-e",
        distance: 0.5,
      },
      {
        historyBookId: "source",
        occurredAt: new Date("2026-06-24T10:00:00+09:00"),
        bookId: "candidate-f",
        distance: 0.4,
      },
      {
        historyBookId: "source",
        occurredAt: new Date("2026-06-23T10:00:00+09:00"),
        bookId: "candidate-g",
        distance: 0.3,
      },
      {
        historyBookId: "source",
        occurredAt: new Date("2026-06-22T10:00:00+09:00"),
        bookId: "candidate-h",
        distance: 0.2,
      },
      {
        historyBookId: "source",
        occurredAt: new Date("2026-06-21T10:00:00+09:00"),
        bookId: "candidate-i",
        distance: 0.1,
      },
    ]);
    mockedFindCandidatesFromSearchHistory.mockResolvedValue([]);

    const result = await generateRecommendations("user@example.com");

    expect(result.map((recommendBook) => recommendBook.bookId)).toEqual([
      "candidate-a",
      "candidate-b",
      "candidate-c",
      "candidate-d",
      "candidate-e",
      "candidate-f",
      "candidate-g",
      "candidate-h",
    ]);
    expect(result).toHaveLength(8);
    expect(txQueryMock.mock.calls[2][1]).toEqual([
      "user@example.com",
      [
        "candidate-a",
        "candidate-b",
        "candidate-c",
        "candidate-d",
        "candidate-e",
        "candidate-f",
        "candidate-g",
        "candidate-h",
      ],
      [1, 2, 3, 4, 5, 6, 7, 8],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2],
      [
        new Date("2026-06-29T10:00:00+09:00"),
        new Date("2026-06-28T10:00:00+09:00"),
        new Date("2026-06-27T10:00:00+09:00"),
        new Date("2026-06-26T10:00:00+09:00"),
        new Date("2026-06-25T10:00:00+09:00"),
        new Date("2026-06-24T10:00:00+09:00"),
        new Date("2026-06-23T10:00:00+09:00"),
        new Date("2026-06-22T10:00:00+09:00"),
      ],
    ]);
  });
});
