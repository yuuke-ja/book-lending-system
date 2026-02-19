"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function createExceptionRule(partial = {}) {
  const p = partial as {
    startDate?: string;
    endDate?: string;
    loanPeriodDays?: number;
  };
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startDate: p.startDate ?? "",
    endDate: p.endDate ?? "",
    loanPeriodDays: p.loanPeriodDays ?? 2,
  };
}

export default function AdminPage() {
  const [settings, setSettings] = useState<any>({
    fridayOnly: true,
    loanPeriodDays: 2,
    exceptionRules: [],
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  async function fetchLoanSettings() {
    setStatusMessage("設定を取得中...");
    try {
      const res = await fetch("/api/admin/loan-settings", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();

      const exceptionRules = Array.isArray(data.exceptionRules)
        ? data.exceptionRules.map((rule: any) =>
          createExceptionRule({
            startDate: typeof rule?.startDate === "string" ? rule.startDate : "",
            endDate: typeof rule?.endDate === "string" ? rule.endDate : "",
            loanPeriodDays:
              Number.isInteger(rule?.loanPeriodDays) && rule.loanPeriodDays > 0
                ? rule.loanPeriodDays
                : 2,
          })
        )
        : [];
      //stateに入れる
      setSettings({
        fridayOnly: Boolean(data.fridayOnly),
        loanPeriodDays:
          Number.isInteger(data.loanPeriodDays) && data.loanPeriodDays > 0
            ? data.loanPeriodDays
            : 2,
        exceptionRules,
      });
      setStatusMessage("");
    } catch {
      setStatusMessage("設定取得に失敗しました");
    } finally {
      setIsLoadingSettings(false);
    }
  }

  async function onLoanSettingsChanged(next: any) {
    setStatusMessage("保存中...");
    try {
      const payload = {
        fridayOnly: Boolean(next.fridayOnly),
        loanPeriodDays:
          Number.isInteger(next.loanPeriodDays) && next.loanPeriodDays > 0
            ? next.loanPeriodDays
            : 2,
        exceptionRules: (Array.isArray(next.exceptionRules) ? next.exceptionRules : [])
          .filter((rule: any) => typeof rule?.startDate === "string" && typeof rule?.endDate === "string" && rule.startDate.length > 0 && rule.endDate.length > 0)
          .map((rule: any) => ({
            startDate: rule.startDate,
            endDate: rule.endDate,
            loanPeriodDays:
              Number.isInteger(rule.loanPeriodDays) && rule.loanPeriodDays > 0
                ? rule.loanPeriodDays
                : 2,
          })),
      };

      const res = await fetch("/api/admin/loan-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        try {
          const err = await res.json();
          setStatusMessage(typeof err?.message === "string" ? err.message : "保存に失敗しました");
        } catch {
          setStatusMessage("保存に失敗しました");
        }
        return;
      }
      setStatusMessage("保存しました");
    } catch (error) {
      console.error("エラー:", error);
      setStatusMessage("保存に失敗しました");
    }
  }

  function updateLoanSettings(key: string, value: any) {
    setSettings((prev: any) => {
      const next = { ...prev, [key]: value };
      void onLoanSettingsChanged(next);
      return next;
    });
  }

  function updateExceptionRuleLocal(id: string, key: string, value: any) {
    setSettings((prev: any) => ({
      ...prev,
      exceptionRules: prev.exceptionRules.map((rule: any) =>
        rule.id === id ? { ...rule, [key]: value } : rule
      ),
    }));
  }




  function addExceptionRule() {
    setSettings((prev: any) => ({
      ...prev,
      exceptionRules: [...prev.exceptionRules, createExceptionRule()],
    }));
  }

  function removeExceptionRule(id: string) {
    setSettings((prev: any) => {
      const next = {
        ...prev,
        exceptionRules: prev.exceptionRules.filter((rule: any) => rule.id !== id),
      };
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
      <Link
        href="/"
        className="mt-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800"
      >
        トップページに戻る
      </Link>
      <Link
        href="/admin/registration"
        className="mt-4 ml-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800"
      >
        本登録
      </Link>

      <section className="mt-8 max-w-xl rounded-lg border border-zinc-200 bg-zinc-50 p-5">
        <h2 className="text-lg font-semibold text-zinc-900">通常貸出ルール</h2>
        <div className="mt-4 space-y-4">
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
            <label className="text-sm font-medium text-zinc-800">
              通常時の貸出日数
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
        </div>
      </section>

      <section className="mt-8 max-w-xl rounded-lg border border-zinc-200 bg-zinc-50 p-5">

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">例外貸出ルール</h2>
          <button
            type="button"
            onClick={addExceptionRule}
            disabled={isLoadingSettings}
            className="rounded-md bg-zinc-900 px-3 py-1 text-sm text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            追加
          </button>
        </div>
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onLoanSettingsChanged(settings)}
            disabled={isLoadingSettings}
            className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            更新
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {settings.exceptionRules.length === 0 && (
            <p className="text-sm text-zinc-600">例外ルールはまだありません。</p>
          )}

          {settings.exceptionRules.map((rule: any, index: number) => (
            <div key={rule.id} className="rounded-md border border-zinc-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-800">例外ルール {index + 1}</p>
                <button
                  type="button"
                  onClick={() => removeExceptionRule(rule.id)}
                  disabled={isLoadingSettings}
                  className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  削除
                </button>
              </div>


              <p className="mb-2 text-sm font-medium text-zinc-800">長期休みの貸出期間</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="date"
                  value={rule.startDate}
                  onChange={(e) => updateExceptionRuleLocal(rule.id, "startDate", e.target.value)}
                  disabled={isLoadingSettings}
                />
                <span className="text-zinc-500">〜</span>
                <input
                  type="date"
                  value={rule.endDate}
                  onChange={(e) => updateExceptionRuleLocal(rule.id, "endDate", e.target.value)}
                  disabled={isLoadingSettings}
                />
              </div>

              <label className="mt-3 block text-sm font-medium text-zinc-800">
                例外期間中の貸出日数
                <input
                  type="number"
                  min={1}
                  value={rule.loanPeriodDays}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    updateExceptionRuleLocal(rule.id, "loanPeriodDays", Number.isFinite(num) && num > 0 ? num : 1);
                  }}
                  disabled={isLoadingSettings}
                  className="ml-2 w-24 rounded border border-zinc-300 bg-white px-2 py-1"
                />
                <span className="ml-1 text-sm text-zinc-600">日</span>
              </label>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-4 max-w-xl text-xs text-zinc-600">{statusMessage}</p>
    </main>
  );
}
