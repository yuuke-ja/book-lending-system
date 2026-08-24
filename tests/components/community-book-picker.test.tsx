// @vitest-environment jsdom
/* eslint-disable @next/next/no-img-element -- next/image is intentionally reduced to an img in this component unit test */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommunityBookPickerPage from "@/app/(user)/community/book-picker/page";

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  returnTo: null as string | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mocks.back, push: mocks.push }),
  useSearchParams: () => ({
    get: (key: string) => (key === "returnTo" ? mocks.returnTo : null),
  }),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

vi.mock("@smastrom/react-rating", () => ({
  Rating: ({ value }: { value: number }) => <span>rating:{value}</span>,
}));

const tag = { id: "tag-tech", tag: "技術" };
const initialBook = {
  id: "book-initial",
  title: "最初の本",
  authors: ["著者A"],
  isbn13: "9780000000001",
  thumbnail: null,
  averageRating: 4,
  tags: [tag],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installInitialFetch() {
  return vi.mocked(fetch).mockImplementation((input) => {
    const url = String(input);
    if (url === "/api/book/search/gettag") {
      return Promise.resolve(jsonResponse([tag]));
    }
    if (url === "/api/book/list") {
      return Promise.resolve(jsonResponse([initialBook]));
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe("CommunityBookPickerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.returnTo = null;
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("alert", vi.fn());
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("本とジャンルを読み込んで表示する", async () => {
    installInitialFetch();
    render(<CommunityBookPickerPage />);

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
    expect(await screen.findByText("最初の本")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "技術" })).toBeInTheDocument();
    expect(screen.getByText("rating:4")).toBeInTheDocument();
  });

  it("自由文は全文検索、選択ジャンルIDはジャンル検索へ完全分離する", async () => {
    const user = userEvent.setup();
    const fullBook = {
      ...initialBook,
      id: "book-full",
      title: "全文検索本",
    };
    const tagBook = {
      ...initialBook,
      id: "book-tag",
      title: "ジャンル検索本",
    };
    const fetchMock = vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/book/search/gettag") {
        return Promise.resolve(jsonResponse([tag]));
      }
      if (url === "/api/book/list") {
        return Promise.resolve(jsonResponse([initialBook]));
      }
      if (url === "/api/book/search/full-text?query=React") {
        return Promise.resolve(jsonResponse([fullBook]));
      }
      if (url === "/api/book/search/tag?tagIds=tag-tech") {
        return Promise.resolve(jsonResponse([tagBook]));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    render(<CommunityBookPickerPage />);
    await screen.findByText("最初の本");

    await user.click(screen.getByRole("button", { name: "技術" }));
    expect(
      screen.getByRole("button", { name: "技術を削除" })
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("検索"), "React");
    await user.click(screen.getByRole("button", { name: "検索" }));

    expect(await screen.findByText("全文検索本")).toBeInTheDocument();
    expect(screen.getByText("ジャンル検索本")).toBeInTheDocument();
    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls).toContain("/api/book/search/full-text?query=React");
    expect(urls).toContain("/api/book/search/tag?tagIds=tag-tech");
    expect(urls).not.toContain(
      "/api/book/search/full-text?query=%E6%8A%80%E8%A1%93%20React"
    );
  });

  it("選択本のIDと表示情報を保存し、明示されたreturnToへ戻る", async () => {
    const user = userEvent.setup();
    mocks.returnTo = "/admin/notices";
    installInitialFetch();
    render(<CommunityBookPickerPage />);
    const card = await screen.findByRole("link", { name: "最初の本を選択" });

    await user.click(card);

    expect(JSON.parse(String(sessionStorage.getItem("selectedBook")))).toEqual({
      bookId: "book-initial",
      booktitle: "最初の本",
      bookthumbnail: null,
    });
    expect(mocks.push).toHaveBeenCalledWith("/admin/notices");
    expect(mocks.back).not.toHaveBeenCalled();
  });

  it("returnToが無い時は履歴へ戻り、Enterでも本を選択できる", async () => {
    const user = userEvent.setup();
    installInitialFetch();
    render(<CommunityBookPickerPage />);
    const card = await screen.findByRole("link", { name: "最初の本を選択" });
    card.focus();

    await user.keyboard("{Enter}");

    expect(mocks.back).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("selectedBook")).toContain("book-initial");
  });
});
