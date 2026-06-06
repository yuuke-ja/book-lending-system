"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ExceptionRule = {
  id: string;
  startDate: string;
  endDate: string;
  loanPeriodDays: number;
};

type LoanSettings = {
  fridayOnly: boolean;
  loanPeriodDays: number;
  exceptionRules: ExceptionRule[];
};

type ExceptionRulePartial = Partial<Omit<ExceptionRule, "id">>;

function createExceptionRule(partial: ExceptionRulePartial = {}): ExceptionRule {
  const p = partial;
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startDate: p.startDate ?? "",
    endDate: p.endDate ?? "",
    loanPeriodDays: p.loanPeriodDays ?? 2,
  };
}

export default function AdminPage() {
  const [settings, setSettings] = useState<LoanSettings>({
    fridayOnly: true,
    loanPeriodDays: 2,
    exceptionRules: [],
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [selectweek, setSelectweek] = useState<number>(1)
  const week = [{ value: 1, label: "月" }, { value: 2, label: "火" }, { value: 3, label: "水" },]

  async function onLoanSettingsChanged(next: LoanSettings) {
    setStatusMessage("保存中...");
    try {
      const payload = {
        fridayOnly: Boolean(next.fridayOnly),
        returnweek: selectweek,
        exceptionRules: next.exceptionRules
          .filter((rule) => rule.startDate.length > 0 && rule.endDate.length > 0)
          .map((rule) => ({
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

  function updateLoanSettings(
    key: "fridayOnly" | "loanPeriodDays",
    value: LoanSettings["fridayOnly"] | LoanSettings["loanPeriodDays"]
  ) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      return next;
    });
  }

  function updateExceptionRuleLocal(
    id: string,
    key: "startDate" | "endDate" | "loanPeriodDays",
    value: ExceptionRule["startDate"] | ExceptionRule["endDate"] | ExceptionRule["loanPeriodDays"]
  ) {
    setSettings((prev) => ({
      ...prev,
      exceptionRules: prev.exceptionRules.map((rule) =>
        rule.id === id ? { ...rule, [key]: value } : rule
      ),
    }));
  }




  function addExceptionRule() {
    setSettings((prev) => ({
      ...prev,
      exceptionRules: [...prev.exceptionRules, createExceptionRule()],
    }));
  }

  function removeExceptionRule(id: string) {
    setSettings((prev) => ({
      ...prev,
      exceptionRules: prev.exceptionRules.filter((rule) => rule.id !== id),
    }));
  }

  useEffect(() => {
    const fetchSettings = async () => {
      setStatusMessage("設定を取得中...");
      try {
        const res = await fetch("/api/admin/loan-settings", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data: {
          fridayOnly?: unknown;
          loanPeriodDays?: unknown;
          exceptionRules?: Array<{
            startDate?: unknown;
            endDate?: unknown;
            loanPeriodDays?: unknown;
          }>;
        } = await res.json();

        const toPositiveDays = (value: unknown): number => {
          return Number.isInteger(value) && (value as number) > 0 ? (value as number) : 2;
        };
        const toReturnWeek = (value: unknown): number => {
          return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 3
            ? (value as number)
            : 1;
        };

        const exceptionRules = Array.isArray(data.exceptionRules)
          ? data.exceptionRules.map((rule) =>
            createExceptionRule({
              startDate: typeof rule?.startDate === "string" ? rule.startDate : "",
              endDate: typeof rule?.endDate === "string" ? rule.endDate : "",
              loanPeriodDays: toPositiveDays(rule?.loanPeriodDays),
            })
          )
          : [];
        setSettings({
          fridayOnly: Boolean(data.fridayOnly),
          loanPeriodDays: toPositiveDays(data.loanPeriodDays),
          exceptionRules,
        });
        setSelectweek(toReturnWeek(data.loanPeriodDays));
        setStatusMessage("");
      } catch {
        setStatusMessage("設定取得に失敗しました");
      } finally {
        setIsLoadingSettings(false);
      }
    };

    fetchSettings();
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
      <Link
        href="/admin/statistics"
        className="mt-4 ml-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800"
      >
        統計を見る
      </Link>
      <Link
        href="/admin/tags"
        className="mt-4 ml-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800"
      >
        タグ管理
      </Link>

      <section className="mt-8 max-w-xl rounded-lg border border-zinc-200 bg-zinc-50 p-5">
        <h2 className="text-lg font-semibold text-zinc-900">通常貸出ルール</h2>
        <div className="mt-4 space-y-4">
          <button onClick={() => onLoanSettingsChanged(settings)} className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-300">
            保存
          </button>
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
            {week.map((d) => (
              <label key={d.value}>
                <input
                  type="radio"
                  name="returnWeekday"
                  value={d.value}
                  checked={selectweek === d.value}
                  onChange={() => setSelectweek(d.value)}
                />
                {d.label}
              </label>
            ))}
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

          {settings.exceptionRules.map((rule, index) => (
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

      {/*貸出履歴*/}
      <section className="mt-8 max-w-xl rounded-lg border border-zinc-200 bg-zinc-50 p-5">
        <h2 className="text-lg font-semibold text-zinc-900">貸出履歴</h2>
        <p className="mt-3 text-sm text-zinc-600">
          貸出中ユーザー一覧は貸出履歴ページで確認できます。
        </p>
        <Link
          href="/admin/history"
          className="mt-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800"
        >
          貸出履歴を見る
        </Link>
      </section>




      <p className="mt-4 max-w-xl text-xs text-zinc-600">{statusMessage}</p>

    </main>
  );
}
