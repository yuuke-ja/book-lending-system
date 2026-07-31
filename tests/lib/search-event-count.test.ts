import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { recordSearchEvent } from "@/lib/search-event.server";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

const mockedTransaction = db.transaction as unknown as ReturnType<typeof vi.fn>;
const mockedTransactionQuery = vi.fn();

describe("検索履歴の検索結果件数保存", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedTransaction.mockImplementation(
      async (callback: (tx: { query: typeof mockedTransactionQuery }) => unknown) =>
        callback({ query: mockedTransactionQuery })
    );
    mockedTransactionQuery.mockResolvedValue({
      rows: [
        {
          id: "search-event-1",
          userEmail: "user@example.com",
          searchType: "book_list",
          query: "Go言語",
          occurredAt: new Date("2026-07-31T00:00:00Z"),
        },
      ],
    });
  });

  it("countカラムと検索結果件数をINSERTへ渡す", async () => {
    await recordSearchEvent({
      userEmail: "user@example.com",
      query: "Go言語",
      searchType: "book_list",
      count: 4,
    });

    expect(mockedTransactionQuery).toHaveBeenCalledTimes(1);
    expect(mockedTransactionQuery.mock.calls[0]?.[0]).toContain('"count"');
    expect(mockedTransactionQuery.mock.calls[0]?.[1]).toEqual([
      "user@example.com",
      "book_list",
      "Go言語",
      4,
    ]);
  });
});
