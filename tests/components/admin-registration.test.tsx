// @vitest-environment jsdom
/* eslint-disable @next/next/no-img-element -- next/image is intentionally reduced to an img in this component unit test */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminRegistrationPage from "@/app/(admin)/admin/registration/page";

const actions = vi.hoisted(() => ({
  createPendingBook: vi.fn(),
  deletePendingBook: vi.fn(),
  registerPendingBooks: vi.fn(),
}));

vi.mock("@/lib/action/admin/book-registration", () => ({
  registerPendingBooks: actions.registerPendingBooks,
}));

vi.mock("@/lib/action/admin/pending-books", () => ({
  createPendingBook: actions.createPendingBook,
  deletePendingBook: actions.deletePendingBook,
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

vi.mock("@/app/_components/ISBNImportModal", () => ({
  default: ({
    open,
    onClose,
    onDetected,
  }: {
    open: boolean;
    onClose: () => void;
    onDetected: (isbn: string) => unknown;
  }) =>
    open ? (
      <button
        type="button"
        onClick={() => {
          onClose();
          void onDetected("9781234567890");
        }}
      >
        テストISBNを検出
      </button>
    ) : null,
}));

const pendingBook = {
  id: "pending-1",
  googleBookId: "google-1",
  isbn13: "9781234567890",
  title: "仮登録の本",
  authors: ["著者A"],
  description: "説明",
  thumbnail: "https://example.test/book.png",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AdminRegistrationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));
    actions.createPendingBook.mockResolvedValue({
      ok: true,
      status: 201,
      message: "仮登録しました",
      data: pendingBook,
    });
    actions.deletePendingBook.mockResolvedValue({
      ok: true,
      status: 200,
      message: "削除しました",
    });
    actions.registerPendingBooks.mockResolvedValue({
      ok: true,
      status: 200,
      message: "登録しました",
      data: { embeddingCount: 1 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("pending一覧の取得結果と空状態を描画する", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([pendingBook]));
    const view = render(<AdminRegistrationPage />);
    expect(await screen.findByText("仮登録の本")).toBeInTheDocument();
    expect(screen.getByText("著者A")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/admin/pendingbook", { method: "GET" });
    view.unmount();

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([]));
    render(<AdminRegistrationPage />);
    expect(
      await screen.findByText("登録する書籍がありません")
    ).toBeInTheDocument();
  });

  it("scanしたISBNの書誌情報を取得して仮登録一覧へ追加する", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/admin/pendingbook") {
        return Promise.resolve(jsonResponse([]));
      }
      if (url === "/api/admin/qrcode/book?isbn=9781234567890") {
        return Promise.resolve(jsonResponse(pendingBook));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    render(<AdminRegistrationPage />);
    await screen.findByText("登録する書籍がありません");

    await user.click(screen.getByRole("button", { name: "ISBN/JANを読み取る" }));
    await user.click(screen.getByRole("button", { name: "テストISBNを検出" }));

    expect(await screen.findByText("仮登録の本")).toBeInTheDocument();
    expect(actions.createPendingBook).toHaveBeenCalledWith({
      googleBookId: "google-1",
      isbn13: "9781234567890",
      title: "仮登録の本",
      authors: ["著者A"],
      description: "説明",
      thumbnail: "https://example.test/book.png",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/qrcode/book?isbn=9781234567890"
    );
  });

  it("pending削除と一括登録成功を即座にUIへ反映する", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(jsonResponse([pendingBook]));
    const view = render(<AdminRegistrationPage />);
    await screen.findByText("仮登録の本");

    await user.click(
      screen.getByRole("button", { name: "仮登録の本 を削除" })
    );
    await waitFor(() =>
      expect(screen.queryByText("仮登録の本")).not.toBeInTheDocument()
    );
    expect(actions.deletePendingBook).toHaveBeenCalledWith("pending-1");
    view.unmount();

    vi.mocked(fetch).mockResolvedValue(jsonResponse([pendingBook]));
    render(<AdminRegistrationPage />);
    await screen.findByText("仮登録の本");
    await user.click(screen.getByRole("button", { name: "登録する" }));
    await waitFor(() =>
      expect(screen.getByText("登録する書籍がありません")).toBeInTheDocument()
    );
    expect(actions.registerPendingBooks).toHaveBeenCalledTimes(1);
  });

  it("一括登録中はボタンを無効化し、連打しても一度だけ実行する", async () => {
    const user = userEvent.setup();
    let resolveRegistration!: (value: {
      ok: true;
      status: 200;
      message: string;
      data: { embeddingCount: number };
    }) => void;
    vi.mocked(fetch).mockResolvedValue(jsonResponse([pendingBook]));
    actions.registerPendingBooks.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRegistration = resolve;
      })
    );
    render(<AdminRegistrationPage />);
    await screen.findByText("仮登録の本");

    await user.click(screen.getByRole("button", { name: "登録する" }));
    const pendingButton = screen.getByRole("button", { name: /登録中/ });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(actions.registerPendingBooks).toHaveBeenCalledTimes(1);

    resolveRegistration({
      ok: true,
      status: 200,
      message: "登録しました",
      data: { embeddingCount: 1 },
    });
    await waitFor(() =>
      expect(screen.getByText("登録する書籍がありません")).toBeInTheDocument()
    );
  });

  it("書誌取得失敗を表示し、5秒後に自動で消す", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation((input) => {
      if (String(input) === "/api/admin/pendingbook") {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({ error: "外部API失敗" }, 500));
    });
    render(<AdminRegistrationPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "ISBN/JANを読み取る" }));
    fireEvent.click(screen.getByRole("button", { name: "テストISBNを検出" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("外部API失敗")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText("外部API失敗")).not.toBeInTheDocument();
  });
});
