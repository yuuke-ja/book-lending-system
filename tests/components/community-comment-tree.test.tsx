// @vitest-environment jsdom
/* eslint-disable @next/next/no-img-element -- next/image is intentionally reduced to an img in this component unit test */

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommentTree, {
  type ThreadCommentNode,
} from "@/app/(user)/community/[threadId]/_components/CommentTree";

const mocks = vi.hoisted(() => ({
  createComment: vi.fn(),
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

vi.mock("@/lib/action/comment", () => ({
  createComment: mocks.createComment,
}));

const linkedBook = {
  id: "book-1",
  title: "リンク本",
  thumbnail: "https://example.test/book.png",
};

const child: ThreadCommentNode = {
  id: "comment-child",
  threadId: "thread-1",
  parentCommentId: "comment-root",
  content: "子コメント",
  createdAt: "2026-01-02T00:00:00.000Z",
  nickname: "子ユーザー",
  authorAvatarUrl: null,
  linkedBooks: [],
  children: [],
};

const root: ThreadCommentNode = {
  id: "comment-root",
  threadId: "thread-1",
  parentCommentId: null,
  content: "親コメント",
  createdAt: "2026-01-01T00:00:00.000Z",
  nickname: "親ユーザー",
  authorAvatarUrl: null,
  linkedBooks: [linkedBook],
  children: [child],
};

describe("CommentTree", () => {
  let intersectionCallback: IntersectionObserverCallback;
  const observe = vi.fn();
  const disconnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal(
      "IntersectionObserver",
      class IntersectionObserverMock {
        constructor(callback: IntersectionObserverCallback) {
          intersectionCallback = callback;
        }
        observe = observe;
        disconnect = disconnect;
        unobserve = vi.fn();
        takeRecords = vi.fn(() => []);
        root = null;
        rootMargin = "0px";
        thresholds = [0.5];
      }
    );
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("入れ子コメントを表示し、親ID付きで返信する", async () => {
    const user = userEvent.setup();
    mocks.createComment.mockResolvedValueOnce({ status: 200, message: "成功" });
    render(<CommentTree comments={[root]} threadId="thread-1" />);

    expect(screen.getByText("親コメント")).toBeInTheDocument();
    expect(screen.getByText("子コメント")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "返信する" })[0]);
    await user.type(screen.getByPlaceholderText("返信を書く"), "  返信本文  ");
    await user.click(screen.getAllByRole("button", { name: "返信する" })[0]);

    await waitFor(() =>
      expect(mocks.createComment).toHaveBeenCalledWith({
        threadId: "thread-1",
        parentCommentId: "comment-root",
        content: "返信本文",
        bookIds: [],
      })
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByPlaceholderText("返信を書く")).not.toBeInTheDocument();
  });

  it("50%以上の表示を1秒維持した時だけ閲覧ログを一度送る", async () => {
    vi.useFakeTimers();
    render(<CommentTree comments={[root]} threadId="thread-1" />);
    expect(observe).toHaveBeenCalled();

    act(() => {
      intersectionCallback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.5,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
      vi.advanceTimersByTime(999);
    });
    expect(fetch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/comment/research-event",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          eventType: "post_view",
          bookId: "book-1",
          sourceType: "comment",
          sourceId: "comment-root",
        }),
      })
    );

    act(() => {
      intersectionCallback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 1,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
      vi.advanceTimersByTime(1000);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("本リンクのログをkeepalive送信して一度だけ遷移する", async () => {
    const user = userEvent.setup();
    render(<CommentTree comments={[root]} threadId="thread-1" />);
    const bookButton = screen.getByRole("button", { name: /リンク本/ });

    await user.click(bookButton);
    await user.click(bookButton);

    expect(fetch).toHaveBeenCalledWith(
      "/api/comment/book-link-click",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        body: JSON.stringify({
          eventType: "book_link_click",
          bookId: "book-1",
          sourceType: "comment",
          sourceId: "comment-root",
        }),
      })
    );
    expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith("/book/book-1");
    expect(bookButton).toBeDisabled();
  });

  it("unmount時にIntersectionObserverと保留timerを破棄する", () => {
    vi.useFakeTimers();
    const view = render(<CommentTree comments={[root]} threadId="thread-1" />);
    act(() => {
      intersectionCallback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.5,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    });

    view.unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(disconnect).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
