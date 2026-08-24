// @vitest-environment jsdom
/* eslint-disable @next/next/no-img-element -- next/image is reduced to img in this component test */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookThreadSection from "@/app/(user)/book/[id]/_components/BookThreadSection";
import AdminLoanHistoryClient from "@/app/(admin)/admin/history/_components/AdminLoanHistoryClient";

const mocks = vi.hoisted(() => {
  return {
    createThread: vi.fn(),
  };
});

vi.mock("@/lib/action/thread", () => ({
  createThread: mocks.createThread,
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Server初期データとClient更新", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("本の関連投稿は初期投稿を表示し、投稿成功後にだけ一覧を再取得する", async () => {
    const user = userEvent.setup();
    mocks.createThread.mockResolvedValueOnce({ status: 200 });
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse([
        {
          id: "thread-2",
          content: "投稿後の内容",
          bookId: "book-1",
          kind: "BOOK_TOPIC",
          createdAt: "2026-08-24T01:00:00.000Z",
        },
      ])
    );

    render(
      <BookThreadSection
        bookId="book-1"
        initialThreads={[
          {
            id: "thread-1",
            content: "初期投稿",
            bookId: "book-1",
            kind: "BOOK_TOPIC",
            createdAt: "2026-08-24T00:00:00.000Z",
          },
        ]}
      />
    );

    expect(screen.getByText("初期投稿")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText("この本について投稿する"), "新規投稿");
    await user.click(screen.getByRole("button", { name: "この本について投稿する" }));

    await waitFor(() =>
      expect(mocks.createThread).toHaveBeenCalledWith({
        kind: "BOOK_TOPIC",
        bookId: "book-1",
        content: "新規投稿",
      })
    );
    expect(await screen.findByText("投稿後の内容")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/community/thread?bookId=book-1");
  });

  it("管理者貸出履歴は受け取った初期行をClient側の選択操作で絞り込む", async () => {
    const user = userEvent.setup();
    render(
      <AdminLoanHistoryClient
        error=""
        rows={[
          {
            loanId: "loan-1",
            userEmail: "one@example.com",
            bookId: "book-1",
            loanedAt: "2026-08-20T00:00:00.000Z",
            returnedAt: null,
            dueAt: "2026-08-27T00:00:00.000Z",
            bookTitle: "貸出中の本",
            bookThumbnail: null,
            bookIsbn13: "9780000000001",
            bookAuthors: ["著者A"],
            status: "borrowing",
          },
          {
            loanId: "loan-2",
            userEmail: "two@example.com",
            bookId: "book-2",
            loanedAt: "2026-08-10T00:00:00.000Z",
            returnedAt: "2026-08-15T00:00:00.000Z",
            dueAt: "2026-08-17T00:00:00.000Z",
            bookTitle: "返却済みの本",
            bookThumbnail: null,
            bookIsbn13: "9780000000002",
            bookAuthors: ["著者B"],
            status: "returned",
          },
        ]}
      />
    );

    expect(screen.getByText("貸出中の本")).toBeInTheDocument();
    expect(screen.getByText("返却済みの本")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    await user.selectOptions(screen.getAllByRole("combobox")[1], "returned");

    expect(screen.queryByText("貸出中の本")).not.toBeInTheDocument();
    expect(screen.getByText("返却済みの本")).toBeInTheDocument();
  });
});
