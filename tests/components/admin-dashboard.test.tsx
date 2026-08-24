// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/(admin)/admin/page";
import LoanSettingsPage from "@/app/(admin)/admin/loan-settings/page";

const actions = vi.hoisted(() => ({
  saveLoanSettings: vi.fn(),
}));

vi.mock("@/lib/action/admin/loan-settings", () => ({
  saveLoanSettings: actions.saveLoanSettings,
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

const settingsResponse = {
  fridayOnly: true,
  loanPeriodDays: 2,
  exceptionRules: [
    {
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      loanPeriodDays: 14,
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LoanSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.saveLoanSettings.mockResolvedValue({
      ok: true,
      status: 200,
      message: "保存しました",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(settingsResponse))
    );
    vi.stubGlobal("alert", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("取得した貸出設定をcheckbox、曜日、例外ルールへ反映する", async () => {
    const { container } = render(<LoanSettingsPage />);

    await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked());
    expect(screen.getByLabelText("火曜日")).toBeChecked();
    expect(screen.getByText("例外ルール 1")).toBeInTheDocument();
    const dateInputs = container.querySelectorAll<HTMLInputElement>(
      'input[type="date"]'
    );
    expect(Array.from(dateInputs, (input) => input.value)).toEqual([
      "2026-08-01",
      "2026-08-31",
    ]);
    expect(screen.getByRole("spinbutton")).toHaveValue(14);
  });

  it("設定変更を表示名ではなくreturnweek値と正規化済みルールで保存する", async () => {
    const user = userEvent.setup();
    const { container } = render(<LoanSettingsPage />);
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByLabelText("月曜日"));
    const dateInputs = container.querySelectorAll<HTMLInputElement>(
      'input[type="date"]'
    );
    fireEvent.change(dateInputs[0], { target: { value: "2026-09-01" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-09-30" } });
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "10" },
    });
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(actions.saveLoanSettings).toHaveBeenCalledWith({
        fridayOnly: false,
        returnweek: 1,
        exceptionRules: [
          {
            startDate: "2026-09-01",
            endDate: "2026-09-30",
            loanPeriodDays: 10,
          },
        ],
      })
    );
    expect(alert).toHaveBeenCalledWith("保存しました");
  });

  it("例外ルールを追加・削除できる", async () => {
    const user = userEvent.setup();
    render(<LoanSettingsPage />);
    await screen.findByText("例外ルール 1");

    await user.click(screen.getByRole("button", { name: "追加" }));
    expect(screen.getByText("例外ルール 2")).toBeInTheDocument();
    expect(screen.getAllByRole("spinbutton")).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "削除" })[1]);
    expect(screen.queryByText("例外ルール 2")).not.toBeInTheDocument();
    expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
  });

  it("設定取得失敗と保存失敗をユーザーへ通知する", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, 500));
    const view = render(<LoanSettingsPage />);
    expect(await screen.findByText("設定取得に失敗しました")).toBeInTheDocument();
    view.unmount();

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(settingsResponse));
    actions.saveLoanSettings.mockResolvedValueOnce({
      ok: false,
      status: 400,
      error: "入力エラー",
    });
    render(<LoanSettingsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("入力エラー"));
    consoleError.mockRestore();
  });
});

describe("AdminPage", () => {
  afterEach(cleanup);

  it("貸出ルール設定をフォームではなく遷移メニューとして表示する", () => {
    render(<AdminPage />);

    expect(screen.getByRole("link", { name: "貸出ルール" })).toHaveAttribute(
      "href",
      "/admin/loan-settings"
    );
    expect(screen.queryByText("通常貸出ルール")).not.toBeInTheDocument();
    expect(screen.queryByText("例外貸出ルール")).not.toBeInTheDocument();
  });
});
