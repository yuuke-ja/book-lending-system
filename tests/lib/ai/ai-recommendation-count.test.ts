import { beforeEach, describe, expect, it, vi } from "vitest";
import { aisearcheventlog } from "@/lib/ai/aisearcheventlog";
import { db } from "@/lib/db";
import { recordSearchEvent } from "@/lib/search-event.server";

vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
  },
}));
vi.mock("@/lib/search-event.server", () => ({
  recordSearchEvent: vi.fn(),
}));

const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;
const mockedRecordSearchEvent = recordSearchEvent as unknown as ReturnType<
  typeof vi.fn
>;

describe("AI推薦の検索結果件数", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedQuery.mockResolvedValue({ rows: [] });
    mockedRecordSearchEvent.mockResolvedValue({ id: "search-event-1" });
  });

  it("AIが選んだ本の冊数を検索履歴の保存処理へ渡す", async () => {
    await aisearcheventlog({
      userEmail: "user@example.com",
      query: "Go言語の本",
      recommendedBooks: ["book-1", "book-2", "book-3"],
    });

    expect(mockedRecordSearchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ count: 3 })
    );
  });

  it("AIが本を選ばなければ0を検索履歴の保存処理へ渡す", async () => {
    await aisearcheventlog({
      userEmail: "user@example.com",
      query: "存在しない分野の本",
      recommendedBooks: [],
    });

    expect(mockedRecordSearchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ count: 0 })
    );
  });
});
