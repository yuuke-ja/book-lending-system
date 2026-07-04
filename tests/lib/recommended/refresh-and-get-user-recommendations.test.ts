import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateRecommendations } from "@/lib/Recommended/generate-recommendations";
import { getUserRecommendations } from "@/lib/Recommended/get-user-recommendations";
import { refreshAndGetUserRecommendations } from "@/lib/Recommended/refresh-and-get-user-recommendations";
import { shouldRefreshRecommendations } from "@/lib/Recommended/should-refresh-recommendations";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/Recommended/generate-recommendations", () => ({
  generateRecommendations: vi.fn(),
}));

vi.mock("@/lib/Recommended/get-user-recommendations", () => ({
  getUserRecommendations: vi.fn(),
}));

vi.mock("@/lib/Recommended/should-refresh-recommendations", () => ({
  shouldRefreshRecommendations: vi.fn(),
}));

const mockedGenerateRecommendations = vi.mocked(generateRecommendations);
const mockedGetUserRecommendations = vi.mocked(getUserRecommendations);
const mockedShouldRefreshRecommendations = vi.mocked(shouldRefreshRecommendations);

describe("refreshAndGetUserRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("再生成が不要なら保存済みおすすめだけ返す", async () => {
    mockedShouldRefreshRecommendations.mockResolvedValue(false);
    mockedGetUserRecommendations.mockResolvedValue([
      {
        id: "book-1",
        title: "保存済みの本",
        authors: ["著者"],
        isbn13: "9780000000001",
        thumbnail: null,
        rank: 1,
      },
    ]);

    await expect(
      refreshAndGetUserRecommendations("user@example.com")
    ).resolves.toEqual([
      {
        id: "book-1",
        title: "保存済みの本",
        authors: ["著者"],
        isbn13: "9780000000001",
        thumbnail: null,
        rank: 1,
      },
    ]);
    expect(mockedGenerateRecommendations).not.toHaveBeenCalled();
    expect(mockedGetUserRecommendations).toHaveBeenCalledWith(
      "user@example.com"
    );
  });

  it("再生成に失敗しても保存済みおすすめを返す", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockedShouldRefreshRecommendations.mockResolvedValue(true);
    mockedGenerateRecommendations.mockRejectedValue(new Error("refresh failed"));
    mockedGetUserRecommendations.mockResolvedValue([
      {
        id: "book-1",
        title: "保存済みの本",
        authors: ["著者"],
        isbn13: "9780000000001",
        thumbnail: null,
        rank: 1,
      },
    ]);

    await expect(
      refreshAndGetUserRecommendations("user@example.com")
    ).resolves.toEqual([
      {
        id: "book-1",
        title: "保存済みの本",
        authors: ["著者"],
        isbn13: "9780000000001",
        thumbnail: null,
        rank: 1,
      },
    ]);
    expect(mockedGenerateRecommendations).toHaveBeenCalledWith(
      "user@example.com"
    );
    expect(mockedGetUserRecommendations).toHaveBeenCalledWith(
      "user@example.com"
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "おすすめ本の更新に失敗:",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
