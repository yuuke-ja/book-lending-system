// @vitest-environment jsdom
/* eslint-disable @next/next/no-img-element -- next/image is intentionally reduced to an img in this component unit test */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookInfoEditor from "@/app/(admin)/admin/books/[id]/_components/BookInfoEditor";
import BookTagEditor from "@/app/(admin)/admin/books/[id]/_components/BookTagEditor";
import NoticeForm from "@/app/(admin)/admin/notices/_components/NoticeForm";

const mocks = vi.hoisted(() => ({
  createNotice: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  updateBookInfo: vi.fn(),
  updateBookTags: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));
vi.mock("@/app/_components/LoadingSpinner", () => ({
  default: () => <span>処理中</span>,
}));
vi.mock("@/lib/action/admin/book-info", () => ({
  updateBookInfo: mocks.updateBookInfo,
}));
vi.mock("@/lib/action/admin/book-tags", () => ({
  updateBookTags: mocks.updateBookTags,
}));
vi.mock("@/lib/action/admin/notices", () => ({
  createNotice: mocks.createNotice,
}));
vi.mock(
  "@/app/(admin)/admin/notices/_components/NoticeEditor",
  () => ({
    default: ({
      onChange,
      initialContent,
    }: {
      onChange: (value: object) => void;
      initialContent: object | null;
    }) => (
      <div>
        <span data-testid="initial-content">
          {initialContent ? JSON.stringify(initialContent) : "empty"}
        </span>
        <button
          type="button"
          onClick={() =>
            onChange({
              type: "doc",
              content: [{ type: "paragraph", text: "本文" }],
            })
          }
        >
          本文を設定
        </button>
      </div>
    ),
  })
);

describe("管理画面の編集コンポーネント", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.stubGlobal("alert", vi.fn());
    mocks.updateBookInfo.mockResolvedValue({
      ok: true,
      status: 200,
      message: "本情報を更新しました",
    });
    mocks.updateBookTags.mockResolvedValue({
      ok: true,
      status: 200,
      message: "ジャンルを更新しました",
    });
    mocks.createNotice.mockResolvedValue({
      ok: true,
      status: 200,
      message: "お知らせを登録しました",
    });
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("本情報を編集して保存し、処理中の二重送信を防ぐ", async () => {
    const user = userEvent.setup();
    let resolveUpdate!: (value: {
      ok: true;
      status: 200;
      message: string;
    }) => void;
    mocks.updateBookInfo.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );
    render(
      <BookInfoEditor
        bookId="book-1"
        initialTitle="変更前"
        initialDescription={null}
      />
    );

    const title = screen.getByLabelText("タイトル");
    const description = screen.getByLabelText("詳細説明");
    await user.clear(title);
    await user.type(title, "変更後");
    await user.type(description, "説明文");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    const pendingButton = screen.getByRole("button", { name: "処理中" });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(mocks.updateBookInfo).toHaveBeenCalledTimes(1);
    expect(mocks.updateBookInfo).toHaveBeenCalledWith({
      bookId: "book-1",
      title: "変更後",
      description: "説明文",
    });

    resolveUpdate({ ok: true, status: 200, message: "本情報を更新しました" });
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith("本情報を更新しました")
    );
  });

  it("本情報の保存失敗を表示する", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.updateBookInfo.mockResolvedValueOnce({
      ok: false,
      status: 500,
      error: "更新失敗",
    });
    render(
      <BookInfoEditor
        bookId="book-1"
        initialTitle="本"
        initialDescription="説明"
      />
    );

    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith("変更に失敗しました"));
  });

  it("本の既存ジャンルを外して新しいジャンルを保存する", async () => {
    const user = userEvent.setup();
    render(
      <BookTagEditor
        bookId="book-1"
        title="対象本"
        initialTags={[{ id: "tag-old", tag: "旧ジャンル" }]}
        allTags={[
          { id: "tag-old", tag: "旧ジャンル" },
          { id: "tag-new", tag: "新ジャンル" },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: "ジャンル変更" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    await user.click(screen.getByRole("button", { name: "旧ジャンルを削除" }));
    await user.click(screen.getByRole("button", { name: "新ジャンル" }));
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() =>
      expect(mocks.updateBookTags).toHaveBeenCalledWith({
        bookId: "book-1",
        tags: ["tag-new"],
      })
    );
  });

  it("本ジャンルの保存失敗を表示する", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.updateBookTags.mockResolvedValueOnce({
      ok: false,
      status: 500,
      error: "ジャンル保存失敗",
    });
    render(
      <BookTagEditor
        bookId="book-1"
        title="対象本"
        initialTags={[]}
        allTags={[{ id: "tag-1", tag: "ジャンル" }]}
      />
    );

    await user.click(screen.getByRole("button", { name: "ジャンル変更" }));
    await user.click(screen.getByRole("button", { name: "ジャンル" }));
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith("ジャンル保存失敗"));
  });

  it("お知らせの下書きと選択本を復元し、一時データを破棄する", async () => {
    const draftContent = { type: "doc", content: [{ type: "paragraph" }] };
    sessionStorage.setItem(
      "noticeDraft",
      JSON.stringify({ title: "保存タイトル", content: draftContent })
    );
    sessionStorage.setItem(
      "selectedBook",
      JSON.stringify({
        bookId: "book-1",
        booktitle: "選択した本",
        bookthumbnail: "https://example.test/book.png",
      })
    );

    render(<NoticeForm />);

    expect(await screen.findByDisplayValue("保存タイトル")).toBeInTheDocument();
    expect(screen.getByTestId("initial-content")).toHaveTextContent(
      JSON.stringify(draftContent)
    );
    expect(screen.getByText("選択した本")).toBeInTheDocument();
    expect(sessionStorage.getItem("noticeDraft")).toBeNull();
    expect(sessionStorage.getItem("selectedBook")).toBeNull();
  });

  it("本選択前にお知らせ下書きを保存し、returnTo付きpickerへ移動する", async () => {
    const user = userEvent.setup();
    render(<NoticeForm />);
    await user.type(screen.getByLabelText("タイトル"), "入力途中");
    await user.click(screen.getByRole("button", { name: "本文を設定" }));

    await user.click(screen.getByRole("button", { name: "本を選択" }));

    expect(mocks.push).toHaveBeenCalledWith(
      "/community/book-picker?returnTo=/admin/notices"
    );
    expect(JSON.parse(String(sessionStorage.getItem("noticeDraft")))).toEqual({
      title: "入力途中",
      content: {
        type: "doc",
        content: [{ type: "paragraph", text: "本文" }],
      },
    });
  });

  it("お知らせ登録の成功と失敗を表示する", async () => {
    const user = userEvent.setup();
    const view = render(<NoticeForm />);
    await user.type(screen.getByLabelText("タイトル"), "お知らせ");
    await user.click(screen.getByRole("button", { name: "本文を設定" }));
    await user.click(screen.getByRole("button", { name: /^登録$/ }));

    await waitFor(() =>
      expect(mocks.createNotice).toHaveBeenCalledWith({
        title: "お知らせ",
        content: {
          type: "doc",
          content: [{ type: "paragraph", text: "本文" }],
        },
        bookId: null,
      })
    );
    expect(alert).toHaveBeenCalledWith("お知らせを登録しました");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    view.unmount();

    mocks.createNotice.mockResolvedValueOnce({
      ok: false,
      status: 400,
      error: "入力エラー",
    });
    render(<NoticeForm />);
    await user.click(screen.getByRole("button", { name: /^登録$/ }));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith("エラー: 入力エラー")
    );
  });
});
