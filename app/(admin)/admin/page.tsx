"use client";

import {
  ArrowLeft,
  BarChart2,
  Bell,
  BookOpen,
  Cpu,
  Folder,
  History,
  Plus,
  RefreshCw,
  Save,
  Search,
  Tags,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
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

const adminMenu: {
  label: string;
  href: string;
  icon: LucideIcon;
  color: string;
}[] = [
  {
    label: "本登録",
    href: "/admin/registration",
    icon: BookOpen,
    color: "border-blue-100 bg-blue-50 text-blue-600",
  },
  {
    label: "本一覧",
    href: "/admin/books",
    icon: Folder,
    color: "border-indigo-100 bg-indigo-50 text-indigo-600",
  },
  {
    label: "タグ管理",
    href: "/admin/tags",
    icon: Tags,
    color: "border-purple-100 bg-purple-50 text-purple-600",
  },
  {
    label: "お知らせ管理",
    href: "/admin/notices",
    icon: Bell,
    color: "border-pink-100 bg-pink-50 text-pink-600",
  },
  {
    label: "統計を見る",
    href: "/admin/statistics",
    icon: BarChart2,
    color: "border-emerald-100 bg-emerald-50 text-emerald-600",
  },
  {
    label: "イベント分析",
    href: "/admin/events",
    icon: TrendingUp,
    color: "border-amber-100 bg-amber-50 text-amber-600",
  },
  {
    label: "ベクトル精度テスト",
    href: "/admin/embedding-test",
    icon: Cpu,
    color: "border-cyan-100 bg-cyan-50 text-cyan-600",
  },
  {
    label: "貸出履歴",
    href: "/admin/history",
    icon: History,
    color: "border-rose-100 bg-rose-50 text-rose-600",
  },
  {
    label: "検索履歴",
    href: "/admin/seachhistory",
    icon: Search,
    color: "border-sky-100 bg-sky-50 text-sky-600",
  },
];

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
        let message = "保存に失敗しました";
        try {
          const err = await res.json();
          message = typeof err?.message === "string" ? err.message : message;
        } catch {
          // レスポンス本文がJSONでない場合は既定の文言を使う。
        }
        setStatusMessage("");
        window.alert(message);
        return;
      }
      setStatusMessage("");
      window.alert("保存しました");
    } catch (error) {
      console.error("エラー:", error);
      setStatusMessage("");
      window.alert("保存に失敗しました");
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
    <main className="min-h-screen bg-[#f0f4f8] pb-16 text-slate-900">
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 sm:pt-10">
        <header className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">
                管理者ダッシュボード
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                システムの各種設定やデータ管理を直感的に行えます。
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              トップページに戻る
            </Link>
          </div>

          <nav className="mt-8 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
            {adminMenu.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex min-h-24 flex-col items-center justify-center gap-2.5 rounded-xl border border-slate-100 bg-white p-4 text-center transition hover:border-blue-200 hover:bg-blue-50/30"
                >
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-transform group-hover:scale-105 ${item.color}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-bold text-slate-700 group-hover:text-slate-950">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </header>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-600">
                  NORMAL LENDING RULES
                </p>
                <h2 className="text-lg font-bold text-slate-900">
                  通常貸出ルール
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onLoanSettingsChanged(settings)}
                disabled={isLoadingSettings}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                保存
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex max-w-sm items-center justify-between gap-4">
                <p className="text-sm font-medium text-slate-700">
                  金曜日のみ貸出
                </p>
                <label className="inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={settings.fridayOnly}
                    onChange={(e) => updateLoanSettings("fridayOnly", e.target.checked)}
                    disabled={isLoadingSettings}
                    className="peer sr-only"
                  />
                  <span
                    className="
                      relative h-6 w-11 rounded-full bg-slate-200 transition-colors
                      peer-checked:bg-blue-600
                      peer-disabled:cursor-not-allowed peer-disabled:opacity-60
                      after:absolute after:left-[2px] after:top-[2px]
                      after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow
                      after:content-[''] after:transition-transform
                      peer-checked:after:translate-x-5
                    "
                  />
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  曜日指定
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {week.map((d) => (
                    <label
                      key={d.value}
                      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 transition hover:bg-slate-100"
                    >
                      <input
                        type="radio"
                        name="returnWeekday"
                        value={d.value}
                        checked={selectweek === d.value}
                        onChange={() => setSelectweek(d.value)}
                        disabled={isLoadingSettings}
                        className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-bold text-slate-700">
                        {d.label}曜日
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-600">
                  EXCEPTIONAL RULES
                </p>
                <h2 className="text-lg font-bold text-slate-900">
                  例外貸出ルール
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onLoanSettingsChanged(settings)}
                  disabled={isLoadingSettings}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-red-500 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  更新
                </button>
                <button
                  type="button"
                  onClick={addExceptionRule}
                  disabled={isLoadingSettings}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  追加
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {settings.exceptionRules.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-medium text-slate-500">
                  例外ルールはまだありません。
                </div>
              )}

              {settings.exceptionRules.map((rule, index) => (
                <div
                  key={rule.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-800">
                      例外ルール {index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeExceptionRule(rule.id)}
                      disabled={isLoadingSettings}
                      className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300"
                    >
                      削除
                    </button>
                  </div>

                  <p className="mb-2 text-sm font-medium text-slate-700">
                    長期休みの貸出期間
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <input
                      type="date"
                      value={rule.startDate}
                      onChange={(e) => updateExceptionRuleLocal(rule.id, "startDate", e.target.value)}
                      disabled={isLoadingSettings}
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 disabled:bg-slate-100"
                    />
                    <span className="text-slate-500">〜</span>
                    <input
                      type="date"
                      value={rule.endDate}
                      onChange={(e) => updateExceptionRuleLocal(rule.id, "endDate", e.target.value)}
                      disabled={isLoadingSettings}
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 disabled:bg-slate-100"
                    />
                  </div>

                  <label className="mt-4 block text-sm font-medium text-slate-700">
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
                      className="ml-2 h-10 w-24 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 disabled:bg-slate-100"
                    />
                    <span className="ml-1 text-sm text-slate-600">日</span>
                  </label>
                </div>
              ))}
            </div>
          </section>
        </div>

        {statusMessage && (
          <p className="mt-4 text-xs font-medium text-slate-500">{statusMessage}</p>
        )}
      </div>
    </main>
  );
}
