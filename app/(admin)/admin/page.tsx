"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LoanSettings = {
  fridayOnly: boolean;
  exceptionStartDate: string;
  exceptionEndDate: string;
  loanPeriodDays: number;
};

export default function AdminPage() {
  const [settings, setSettings] = useState<LoanSettings>({
    fridayOnly: true,
    exceptionStartDate: "",
    exceptionEndDate: "",
    loanPeriodDays: 2,
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // サーバーから貸出設定をGETして初期表示に反映する関数。
  async function fetchLoanSettings() {
    setStatusMessage("設定を取得中...");
    try {
      const res = await fetch("/api/admin/loan-settings", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSettings({
        fridayOnly: Boolean(data.fridayOnly),
        exceptionStartDate:
          typeof data.exceptionStartDate === "string" ? data.exceptionStartDate : "",
        exceptionEndDate:
          typeof data.exceptionEndDate === "string" ? data.exceptionEndDate : "",
        loanPeriodDays:
          Number.isInteger(data.loanPeriodDays) && data.loanPeriodDays > 0
            ? data.loanPeriodDays
            : 2,
      });
      setStatusMessage("");
    } catch {
      setStatusMessage("設定取得に失敗しました");
    } finally {
      setIsLoadingSettings(false);
    }
  }

  // 貸出設定が変更されたときに保存APIへ送る関数。
  async function onLoanSettingsChanged(next: LoanSettings) {
    setStatusMessage("保存中...");
    try {
      const res = await fetch("/api/admin/loan-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error();
      setStatusMessage("保存しました");
    } catch {
      setStatusMessage("保存に失敗しました");
    }
  }

  // 入力値をstateに反映して onLoanSettingsChanged を実行する関数。
  function updateLoanSettings<K extends keyof LoanSettings>(
    key: K,
    value: LoanSettings[K]
  ) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      void onLoanSettingsChanged(next);
      return next;
    });
  }

  useEffect(() => {
    void fetchLoanSettings();
  }, []);

  return (
    <main className="min-h-screen bg-white p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">管理者ページ</h1>
      <Link href="/" className="mt-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800">
        トップページに戻る
      </Link>
      <Link href="/admin/registration" className="mt-4 ml-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800">
        本登録
      </Link>
      <section className="mt-8 max-w-xl rounded-lg border border-zinc-200 bg-zinc-50 p-5">
        <h2 className="text-lg font-semibold text-zinc-900">貸出設定</h2>

        <form className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-800">金曜日のみ貸出</p>
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.fridayOnly}
                onChange={(e) => updateLoanSettings("fridayOnly", e.target.checked)}
                disabled={isLoadingSettings}
                className="sr-only peer"
              />
              <div
                className="
                  relative h-7 w-12 rounded-full bg-gray-300 transition-colors
                  peer-checked:bg-blue-500
                  after:absolute after:left-[2px] after:top-[2px]
                  after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow
                  after:content-[''] after:transition-transform
                  peer-checked:after:translate-x-5
                "
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-zinc-800">長期休みの貸出期間

            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input
                type="date"
                value={settings.exceptionStartDate}
                onChange={(e) =>
                  updateLoanSettings("exceptionStartDate", e.target.value)
                }
                disabled={isLoadingSettings}
                className="rounded border border-zinc-300 bg-white px-2 py-1"
              />
              <span className="text-zinc-500">〜</span>
              <input
                type="date"
                value={settings.exceptionEndDate}
                onChange={(e) => updateLoanSettings("exceptionEndDate", e.target.value)}
                disabled={isLoadingSettings}
                className="rounded border border-zinc-300 bg-white px-2 py-1"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-800">
              何日借りられるか
              <input
                type="number"
                min={1}
                value={settings.loanPeriodDays}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  updateLoanSettings(
                    "loanPeriodDays",
                    Number.isFinite(num) && num > 0 ? num : 1
                  );
                }}
                disabled={isLoadingSettings}
                className="ml-2 w-24 rounded border border-zinc-300 bg-white px-2 py-1"
              />
              <span className="ml-1 text-sm text-zinc-600">日</span>
            </label>
          </div>
          <p className="text-xs text-zinc-600">{statusMessage}</p>
        </form>
      </section>
    </main>
  );
}
