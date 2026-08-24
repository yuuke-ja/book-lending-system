// @vitest-environment jsdom
/* eslint-disable @next/next/no-img-element -- next/image is intentionally reduced to an img in this component unit test */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookListClient from "@/app/(user)/book-list/_components/BookListClient";
import type { BookListBook, BookListTag } from "@/lib/books/book-list-types";

const mocks = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "test-key";

  const routerPush = vi.fn();
  const removeChannel = vi.fn();
  let loanChangeHandler: (() => void) | null = null;
  const channel = {
    on: vi.fn(
      (
        _event: string,
        _filter: Record<string, unknown>,
        callback: () => void
      ) => {
        loanChangeHandler = callback;
        return channel;
      }
    ),
    subscribe: vi.fn(() => channel),
  };
  const supabase = {
    channel: vi.fn(() => channel),
    removeChannel,
  };

  return {
    channel,
    getLoanChangeHandler: () => loanChangeHandler,
    removeChannel,
    routerPush,
    supabase,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

vi.mock("@smastrom/react-rating", () => ({
  Rating: ({ value }: { value: number }) => <span>rating:{value}</span>,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mocks.supabase,
}));

const tags: BookListTag[] = [
  { id: "tag-tech", tag: "技術" },
  { id: "tag-design", tag: "デザイン" },
];

const initialBooks: BookListBook[] = [
  {
    id: "book-initial",
    title: "最初の本",
    authors: ["著者A"],
    isbn13: "9780000000001",
    averageRating: 4,
    tags: [tags[0]],
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderBookList() {
  return render(
    <BookListClient
      initialBooks={initialBooks}
      initialLoanedBookIds={["book-initial"]}
      initialTags={tags}
    />
  );
}

describe("BookListClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("alert", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("初期本、ジャンル、評価、貸出状態を表示する", () => {
    renderBookList();

    expect(screen.getByText("最初の本")).toBeInTheDocument();
    expect(screen.getByText("著者A")).toBeInTheDocument();
    expect(screen.getByText("rating:4")).toBeInTheDocument();
    expect(screen.getByText("貸出中")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "技術" })).toBeInTheDocument();
  });

  it("自由文とジャンルIDを別々のAPIへ送り、結果を重複排除してログ保存する", async () => {
    const user = userEvent.setup();
    const sharedBook: BookListBook = {
      id: "book-shared",
      title: "共通の本",
      authors: [],
      isbn13: "9780000000002",
      tags: [tags[0]],
    };
    const fullTextBook: BookListBook = {
      id: "book-full",
      title: "全文検索の本",
      authors: [],
      isbn13: "9780000000003",
      tags: [tags[1]],
    };
    const tagBook: BookListBook = {
      id: "book-tag",
      title: "ジャンル検索の本",
      authors: [],
      isbn13: "9780000000004",
      tags: [tags[0]],
    };
    const fetchMock = vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (url.startsWith("/api/book/search/full-text")) {
        return Promise.resolve(jsonResponse([fullTextBook, sharedBook]));
      }
      if (url.startsWith("/api/book/search/tag")) {
        return Promise.resolve(jsonResponse([sharedBook, tagBook]));
      }
      if (url === "/api/book/search/log" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ id: "event-1" }, 201));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    renderBookList();
    await user.click(screen.getByRole("button", { name: "技術" }));
    await user.type(screen.getByLabelText("検索"), "  React 入門  ");
    await user.click(screen.getByRole("button", { name: "検索" }));

    await screen.findByText("全文検索の本");
    expect(screen.getAllByText("共通の本")).toHaveLength(1);
    expect(screen.getByText("ジャンル検索の本")).toBeInTheDocument();

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(requestedUrls).toContain(
      "/api/book/search/full-text?query=React%20%E5%85%A5%E9%96%80"
    );
    expect(requestedUrls).toContain("/api/book/search/tag?tagIds=tag-tech");

    await waitFor(() => {
      const logCall = fetchMock.mock.calls.find(
        ([input]) => String(input) === "/api/book/search/log"
      );
      expect(logCall).toBeDefined();
      expect(JSON.parse(String(logCall?.[1]?.body))).toEqual({
        query: "React 入門",
        selectedTags: ["技術"],
        resultTagIds: ["tag-design", "tag-tech", "tag-tech"],
        count: 3,
      });
    });
  });

  it("ジャンルだけの検索では全文検索APIを呼ばず、IDと表示名を保持する", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/book/search/tag?tagIds=tag-design") {
        return Promise.resolve(jsonResponse([]));
      }
      if (url === "/api/book/search/log") {
        return Promise.resolve(jsonResponse({}, 201));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    renderBookList();
    await user.click(screen.getByRole("button", { name: "デザイン" }));
    expect(
      screen.getByRole("button", { name: "デザインを削除" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "検索" }));

    expect(await screen.findByText("検索結果がありません")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/book/search/tag?tagIds=tag-design"
    );
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).startsWith("/api/book/search/full-text")
      )
    ).toBe(false);
  });

  it("選択したジャンルを解除できる", async () => {
    const user = userEvent.setup();
    renderBookList();

    await user.click(screen.getByRole("button", { name: "技術" }));
    const removeButton = screen.getByRole("button", { name: "技術を削除" });
    expect(removeButton).toBeInTheDocument();

    await user.click(removeButton);

    expect(
      screen.queryByRole("button", { name: "技術を削除" })
    ).not.toBeInTheDocument();
  });

  it("全文検索APIが失敗したらユーザーへエラーを表示する", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, 500));
    renderBookList();

    await user.type(screen.getByLabelText("検索"), "React");
    await user.click(screen.getByRole("button", { name: "検索" }));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith("全文検索に失敗しました")
    );
    consoleError.mockRestore();
  });

  it("click、Enter、Spaceで詳細へ遷移する", async () => {
    const user = userEvent.setup();
    renderBookList();
    const card = screen.getByRole("link", {
      name: "最初の本の詳細ページを開く",
    });

    await user.click(card);
    card.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(mocks.routerPush).toHaveBeenCalledTimes(3);
    expect(mocks.routerPush).toHaveBeenNthCalledWith(1, "/book/book-initial");
  });

  it("Supabaseの貸出変更を受けて貸出badgeを更新し、unmount時に購読解除する", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([{ bookId: "book-initial" }])
    );
    const view = render(
      <BookListClient
        initialBooks={initialBooks}
        initialLoanedBookIds={[]}
        initialTags={tags}
      />
    );
    expect(screen.queryByText("貸出中")).not.toBeInTheDocument();

    mocks.getLoanChangeHandler()?.();
    expect(await screen.findByText("貸出中")).toBeInTheDocument();

    view.unmount();
    expect(mocks.removeChannel).toHaveBeenCalledWith(mocks.channel);
  });
});
