// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeleteThreadButton from "@/app/(user)/community/[threadId]/_components/DeleteThreadButton";

const mocks = vi.hoisted(() => ({
  deleteThread: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/lib/action/thread", () => ({
  deleteThread: mocks.deleteThread,
}));

describe("DeleteThreadButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("alert", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("本人のスレッドを削除して一覧へ移動する", async () => {
    vi.useFakeTimers();
    mocks.deleteThread.mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "スレッドを削除しました",
    });
    render(<DeleteThreadButton threadId="thread-1" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "削除" }));
      await Promise.resolve();
    });

    expect(mocks.deleteThread).toHaveBeenCalledWith("thread-1");
    expect(screen.getByRole("status")).toHaveTextContent(
      "スレッドを削除しました"
    );
    act(() => vi.advanceTimersByTime(800));
    expect(mocks.replace).toHaveBeenCalledWith("/community");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("確認をキャンセルした場合は削除しない", () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    render(<DeleteThreadButton threadId="thread-1" />);

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(mocks.deleteThread).not.toHaveBeenCalled();
  });
});
