// @vitest-environment jsdom
/* eslint-disable @next/next/no-img-element -- next/image is intentionally reduced to an img in this component unit test */

import type { ComponentType } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoanQrPage from "@/app/(user)/loan/qr/page";
import ReturnQrPage from "@/app/(user)/return/page";

const actions = vi.hoisted(() => ({
  loanBook: vi.fn(),
  returnBook: vi.fn(),
}));

vi.mock("@/lib/action/loan", () => ({ loanBook: actions.loanBook }));
vi.mock("@/lib/action/return", () => ({ returnBook: actions.returnBook }));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

vi.mock("@/app/_components/ISBNScanGuide", () => ({
  default: () => <p>スキャン案内</p>,
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
      <div role="dialog" aria-label="テスト用スキャナ">
        <button
          type="button"
          onClick={() => {
            onClose();
            void onDetected("9781234567890");
          }}
        >
          読取成功
        </button>
        <button type="button" onClick={onClose}>
          スキャナを閉じる
        </button>
      </div>
    ) : null,
}));

const book = {
  id: "book-1",
  title: "テスト駆動の本",
  authors: ["著者A", "著者B"],
  isbn13: "9781234567890",
  description: "説明文",
  thumbnail: "https://example.test/book.png",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type FlowCase = {
  name: string;
  Page: ComponentType;
  scanButton: string;
  confirmPrompt: string;
  actionButton: string;
  submittingText: string;
  successText: string;
  action: ReturnType<typeof vi.fn>;
};

const flows: FlowCase[] = [
  {
    name: "貸出",
    Page: LoanQrPage,
    scanButton: "ISBN/JANを読み取る",
    confirmPrompt: "この本を貸し出しますか？",
    actionButton: "借りる",
    submittingText: "貸出中...",
    successText: "貸出が完了しました",
    action: actions.loanBook,
  },
  {
    name: "返却",
    Page: ReturnQrPage,
    scanButton: "ISBN/JANを読み取る",
    confirmPrompt: "この本を返却しますか？",
    actionButton: "返却する",
    submittingText: "返却中...",
    successText: "返却が完了しました",
    action: actions.returnBook,
  },
];

describe.each(flows)("$name画面", (flow) => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(book)));
    vi.stubGlobal("alert", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function scanBook(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: flow.scanButton }));
    expect(
      screen.getByRole("dialog", { name: "テスト用スキャナ" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "読取成功" }));
    await screen.findByText(flow.confirmPrompt);
  }

  it("scannerを開き、取得した本の確認情報を表示する", async () => {
    const user = userEvent.setup();
    render(<flow.Page />);

    expect(screen.getByText("スキャン案内")).toBeInTheDocument();
    await scanBook(user);

    expect(fetch).toHaveBeenCalledWith(
      "/api/book/borrow?isbn13=9781234567890"
    );
    expect(screen.getByText(book.title)).toBeInTheDocument();
    expect(screen.getByText("著者A, 著者B")).toBeInTheDocument();
    expect(screen.getByText(`ISBN/JAN: ${book.isbn13}`)).toBeInTheDocument();
    expect(screen.getByAltText(book.title)).toBeInTheDocument();
  });

  it("未登録本と一般的な取得失敗を区別して通知する", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, 404));
    const view = render(<flow.Page />);
    await user.click(screen.getByRole("button", { name: flow.scanButton }));
    await user.click(screen.getByRole("button", { name: "読取成功" }));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith("この本は未登録です")
    );

    view.unmount();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));
    render(<flow.Page />);
    await user.click(screen.getByRole("button", { name: flow.scanButton }));
    await user.click(screen.getByRole("button", { name: "読取成功" }));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith("本情報の取得に失敗しました")
    );
  });

  it("Action成功後に完了表示へ切り替え、続けてscanできる", async () => {
    const user = userEvent.setup();
    flow.action.mockResolvedValueOnce({ status: 200, message: "成功" });
    render(<flow.Page />);
    await scanBook(user);

    await user.click(screen.getByRole("button", { name: flow.actionButton }));
    expect(await screen.findByText(flow.successText)).toBeInTheDocument();
    expect(screen.getByText(book.title)).toBeInTheDocument();
    expect(flow.action).toHaveBeenCalledWith(book.id);

    await user.click(screen.getByRole("button", { name: "続けて読み取る" }));
    expect(
      screen.getByRole("dialog", { name: "テスト用スキャナ" })
    ).toBeInTheDocument();
    expect(screen.queryByText(flow.successText)).not.toBeInTheDocument();
  });

  it("処理中はボタンを無効化して二重送信を防ぐ", async () => {
    const user = userEvent.setup();
    let resolveAction!: (value: { status: 200; message: string }) => void;
    flow.action.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      })
    );
    render(<flow.Page />);
    await scanBook(user);

    await user.click(screen.getByRole("button", { name: flow.actionButton }));
    const pendingButton = screen.getByRole("button", {
      name: flow.submittingText,
    });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(flow.action).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAction({ status: 200, message: "成功" });
    });
    expect(await screen.findByText(flow.successText)).toBeInTheDocument();
  });

  it("Action失敗を画面固有のメッセージで通知する", async () => {
    const user = userEvent.setup();
    flow.action.mockResolvedValueOnce(
      flow.name === "返却"
        ? { status: 404, error: "返却する貸出が見つかりません" }
        : { status: 409, error: "この本はすでに貸出中です" }
    );
    render(<flow.Page />);
    await scanBook(user);
    await user.click(screen.getByRole("button", { name: flow.actionButton }));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        flow.name === "返却"
          ? "この本は現在貸出中ではありません"
          : "この本はすでに貸出中です"
      )
    );
  });

  it("曜日外などの貸出理由と一般的な返却失敗を通知する", async () => {
    const user = userEvent.setup();
    flow.action.mockResolvedValueOnce(
      flow.name === "貸出"
        ? { status: 403, error: "今日は貸出できる曜日ではありません" }
        : { status: 500, error: "database error" }
    );
    render(<flow.Page />);
    await scanBook(user);
    await user.click(screen.getByRole("button", { name: flow.actionButton }));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        flow.name === "貸出"
          ? "今日は貸出できる曜日ではありません"
          : "返却に失敗しました"
      )
    );
  });
});
