// @vitest-environment jsdom
/* eslint-disable @next/next/no-img-element -- next/image is intentionally reduced to an img in this component unit test */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ThreadComposer from "@/app/(user)/community/_components/ThreadComposer";
import CommentComposer from "@/app/(user)/community/[threadId]/_components/CommentComposer";

const mocks = vi.hoisted(() => ({
  createComment: vi.fn(),
  createThread: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

vi.mock("@/lib/action/thread", () => ({ createThread: mocks.createThread }));
vi.mock("@/lib/action/comment", () => ({
  createComment: mocks.createComment,
}));

const selectedBook = {
  bookId: "book-1",
  booktitle: "紐付ける本",
  bookthumbnail: "https://example.test/book.png",
};

describe("community composers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("scrollTo", vi.fn());
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("ThreadComposerは下書きと選択本を復元し、一時データを破棄する", async () => {
    sessionStorage.setItem("selectedBook", JSON.stringify(selectedBook));
    sessionStorage.setItem(
      "communityDraftState",
      JSON.stringify({ draft: "保存した投稿", scrollY: 120 })
    );

    render(<ThreadComposer />);

    expect(await screen.findByDisplayValue("保存した投稿")).toBeInTheDocument();
    expect(screen.getByText("紐付ける本")).toBeInTheDocument();
    expect(sessionStorage.getItem("selectedBook")).toBeNull();
    expect(sessionStorage.getItem("communityDraftState")).toBeNull();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 120 });
  });

  it("本あり投稿をBOOK_TOPICとして送信し、成功後に入力をclearする", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("selectedBook", JSON.stringify(selectedBook));
    mocks.createThread.mockResolvedValueOnce({ status: 200, message: "成功" });
    render(<ThreadComposer />);
    const input = screen.getByPlaceholderText("投稿を書く");
    await user.type(input, "  本の感想  ");

    await user.click(screen.getByRole("button", { name: "投稿する" }));

    await waitFor(() =>
      expect(mocks.createThread).toHaveBeenCalledWith({
        kind: "BOOK_TOPIC",
        bookId: "book-1",
        content: "本の感想",
      })
    );
    expect(input).toHaveValue("");
    expect(screen.queryByText("紐付ける本")).not.toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("本なし投稿はBOOK_REQUESTになり、空本文は送信しない", async () => {
    const user = userEvent.setup();
    mocks.createThread.mockResolvedValue({ status: 200, message: "成功" });
    render(<ThreadComposer />);

    await user.click(screen.getByRole("button", { name: "投稿する" }));
    expect(mocks.createThread).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText("投稿を書く"), "探しています");
    await user.click(screen.getByRole("button", { name: "投稿する" }));
    await waitFor(() =>
      expect(mocks.createThread).toHaveBeenCalledWith({
        kind: "BOOK_REQUEST",
        bookId: null,
        content: "探しています",
      })
    );
  });

  it("投稿処理中はボタンを無効化し、連打しても一度しか送信しない", async () => {
    const user = userEvent.setup();
    let resolveThread!: (value: { status: 200; message: string }) => void;
    mocks.createThread.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveThread = resolve;
      })
    );
    render(<ThreadComposer />);
    await user.type(screen.getByPlaceholderText("投稿を書く"), "投稿本文");

    await user.click(screen.getByRole("button", { name: "投稿する" }));
    const pendingButton = screen.getByRole("button", { name: "送信中..." });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(mocks.createThread).toHaveBeenCalledTimes(1);

    resolveThread({ status: 200, message: "成功" });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  it("本選択へ移る前に投稿下書きとscroll位置を保存する", async () => {
    const user = userEvent.setup();
    render(<ThreadComposer />);
    await user.type(screen.getByPlaceholderText("投稿を書く"), "途中の本文");

    await user.click(screen.getByRole("button", { name: "本を紐付ける" }));

    expect(mocks.push).toHaveBeenCalledWith("/community/book-picker");
    expect(JSON.parse(String(sessionStorage.getItem("communityDraftState")))).toMatchObject({
      draft: "途中の本文",
    });
  });

  it("CommentComposerは対象threadの下書きと本を復元して送信する", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("selectedBook", JSON.stringify(selectedBook));
    sessionStorage.setItem(
      "commentDraftState",
      JSON.stringify({
        savedThreadId: "thread-1",
        draft: "保存コメント",
        scrollY: 20,
      })
    );
    mocks.createComment.mockResolvedValueOnce({ status: 200, message: "成功" });

    render(<CommentComposer threadId="thread-1" />);
    expect(await screen.findByDisplayValue("保存コメント")).toBeInTheDocument();
    expect(screen.getByText("紐付ける本")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "コメントする" }));
    await waitFor(() =>
      expect(mocks.createComment).toHaveBeenCalledWith({
        threadId: "thread-1",
        content: "保存コメント",
        bookIds: ["book-1"],
      })
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("commentDraftState")).toBeNull();
  });

  it("送信失敗時はComposer内にエラーを表示する", async () => {
    const user = userEvent.setup();
    mocks.createComment.mockResolvedValueOnce({
      status: 500,
      error: "コメント保存失敗",
    });
    render(<CommentComposer threadId="thread-1" />);
    await user.type(screen.getByPlaceholderText("コメントを書く"), "コメント");
    await user.click(screen.getByRole("button", { name: "コメントする" }));

    expect(await screen.findByText("コメント保存失敗")).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
