"use client";

import { Plus, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { saveLoanSettings } from "@/lib/action/admin/loan-settings";

type ExceptionRule = {
  id: string;
  startDate: string;
  endDate: string;
  loanPeriodDays: number;
};

type LoanSettings = {
  loanEnabled: boolean;
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
    loanEnabled: true,
    fridayOnly: true,
    loanPeriodDays: 2,
    exceptionRules: [],
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [savingSettingsSection, setSavingSettingsSection] = useState<
    "normal" | "exception" | null
  >(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [selectweek, setSelectweek] = useState<number>(1)
  const week = [{ value: 1, label: "月" }, { value: 2, label: "火" }, { value: 3, label: "水" },]

  async function onLoanSettingsChanged(
    next: LoanSettings,
    section: "normal" | "exception"
  ) {
    if (savingSettingsSection) return;
    setSavingSettingsSection(section);
    setStatusMessage("保存中...");
    try {
      const payload = {
        loanEnabled: next.loanEnabled,
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

      const result = await saveLoanSettings(payload);
      if (!result.ok) {
        setStatusMessage("");
        window.alert(result.error);
        return;
      }
      setStatusMessage("");
      window.alert(result.message);
    } catch (error) {
      console.error("エラー:", error);
      setStatusMessage("");
      window.alert("保存に失敗しました");
    } finally {
      setSavingSettingsSection(null);
    }
  }

  function updateLoanSettings(
    key: "loanEnabled" | "fridayOnly" | "loanPeriodDays",
    value:
      | LoanSettings["loanEnabled"]
      | LoanSettings["fridayOnly"]
      | LoanSettings["loanPeriodDays"]
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
          loanEnabled?: unknown;
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
          loanEnabled:
            typeof data.loanEnabled === "boolean" ? data.loanEnabled : true,
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
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">
            貸出ルール設定
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            通常の貸出条件と、長期休みなどの例外期間を設定できます。
          </p>
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
                onClick={() => onLoanSettingsChanged(settings, "normal")}
                disabled={isLoadingSettings || savingSettingsSection !== null}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {savingSettingsSection === "normal" ? (
                  <>
                    <Spinner aria-hidden="true" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    保存
                  </>
                )}
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex max-w-sm items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    貸出機能
                  </p>
                  <p className="text-xs text-slate-500">
                    {settings.loanEnabled ? "ON" : "OFF"}
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    aria-label="貸出機能"
                    checked={settings.loanEnabled}
                    onChange={(e) =>
                      updateLoanSettings("loanEnabled", e.target.checked)
                    }
                    disabled={isLoadingSettings}
                    className="peer sr-only"
                  />
                  <span className="relative h-6 w-11 rounded-full bg-slate-200 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:content-[''] after:transition-transform peer-checked:bg-blue-600 peer-checked:after:translate-x-5 peer-disabled:cursor-not-allowed peer-disabled:opacity-60" />
                </label>
              </div>

              <div className="flex max-w-sm items-center justify-between gap-4">
                <p className="text-sm font-medium text-slate-700">
                  金曜日のみ貸出
                </p>
                <label className="inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    aria-label="金曜日のみ貸出"
                    checked={settings.fridayOnly}
                    onChange={(e) => updateLoanSettings("fridayOnly", e.target.checked)}
                    disabled={isLoadingSettings}
                    className="peer sr-only"
                  />
                  <span className="relative h-6 w-11 rounded-full bg-slate-200 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:content-[''] after:transition-transform peer-checked:bg-blue-600 peer-checked:after:translate-x-5 peer-disabled:cursor-not-allowed peer-disabled:opacity-60" />
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
                  onClick={() => onLoanSettingsChanged(settings, "exception")}
                  disabled={isLoadingSettings || savingSettingsSection !== null}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-red-500 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  {savingSettingsSection === "exception" ? (
                    <>
                      <Spinner aria-hidden="true" />
                      更新中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      更新
                    </>
                  )}
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
                    例外貸出開始日 〜 返却日
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
          <p className="mt-4 text-xs font-medium text-slate-500">
            {statusMessage}
          </p>
        )}
      </div>
    </main>
  );
}
