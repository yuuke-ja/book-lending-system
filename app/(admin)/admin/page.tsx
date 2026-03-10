"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const JST_TIMEZONE = "Asia/Tokyo";
const DAY_MS = 24 * 60 * 60 * 1000;

function toJstDateStartMs(date: Date): number {
  const dateText = date.toLocaleDateString("en-CA", { timeZone: JST_TIMEZONE });
  return new Date(`${dateText}T00:00:00.000+09:00`).getTime();
}

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

type TagItem = {
  id: string;
  tag: string;
};

type LoanRow = {
  id: string;
  userEmail: string;
  bookId: string;
  loanedAt: string;
  dueAt: string | null;
  book_id: string;
  book_googleBookId: string | null;
  book_isbn13: string;
  book_title: string;
  book_authors: string[];
  book_description: string | null;
  book_thumbnail: string | null;
  book_createdAt: string;
  userTotalLoanCount: number;
  userLatestLoanedAt: string;
};

type LoanList = Record<string, LoanRow[]>;

export default function AdminPage() {
  const [settings, setSettings] = useState<LoanSettings>({
    fridayOnly: true,
    loanPeriodDays: 2,
    exceptionRules: [],
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [taglist, setTaglist] = useState<TagItem[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [tagStatusMessage, setTagStatusMessage] = useState("");
  const [loanlist, setloanlist] = useState<LoanList>({});
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

  async function fetchTagList(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (!silent) setTagStatusMessage("タグ一覧を取得中...");
    try {
      const res = await fetch("/api/admin/tags", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTaglist(Array.isArray(data) ? data : []);
      if (!silent) setTagStatusMessage("");
    } catch {
      setTagStatusMessage("タグ一覧の取得に失敗しました");
    } finally {
      setIsLoadingTags(false);
    }
  }

  async function addTag() {
    const tag = tagInput.trim();
    if (!tag) {
      setTagStatusMessage("タグ名を入力してください");
      return;
    }

    setTagStatusMessage("タグを保存中...");
    try {
      const res = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: [tag] }),
      });
      if (!res.ok) {
        try {
          const err = await res.json();
          setTagStatusMessage(
            typeof err?.error === "string" ? err.error : "タグの保存に失敗しました"
          );
        } catch {
          setTagStatusMessage("タグの保存に失敗しました");
        }
        return;
      }

      setTagInput("");
      await fetchTagList({ silent: true });
      setTagStatusMessage("タグを保存しました");
    } catch {
      setTagStatusMessage("タグの保存に失敗しました");
    }
  }

  function updateLoanSettings(
    key: "fridayOnly" | "loanPeriodDays",
    value: LoanSettings["fridayOnly"] | LoanSettings["loanPeriodDays"]
  ) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      //void onLoanSettingsChanged(next);
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

  useEffect(() => {
    const fetchloans = async () => {
      try {
        const res = await fetch("/api/admin/loans-user", { cache: "no-store" });
        if (!res.ok) throw new Error("貸出一覧の取得に失敗しました");

        const ras = await res.json();
        const data: LoanRow[] = Array.isArray(ras) ? ras : [];

        const grouped: LoanList = {};
        data.forEach((d) => {
          if (!grouped[d.userEmail]) grouped[d.userEmail] = [];
          grouped[d.userEmail].push(d);
        });

        setloanlist(grouped);
      } catch (error) {
        console.error(error);
        setloanlist({});
      }
    };

    fetchloans();
  }, []);


  useEffect(() => {
    const fetchInitialTags = async () => {
      setTagStatusMessage("タグ一覧を取得中...");
      try {
        const res = await fetch("/api/admin/tags", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTaglist(Array.isArray(data) ? data : []);
        setTagStatusMessage("");
      } catch {
        setTagStatusMessage("タグ一覧の取得に失敗しました");
      } finally {
        setIsLoadingTags(false);
      }
    };

    fetchInitialTags();
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

      <section className="mt-8 max-w-xl rounded-lg border border-zinc-200 bg-zinc-50 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">タグ管理</h2>
          <button
            type="button"
            onClick={() => {
              void fetchTagList();
            }}
            disabled={isLoadingTags}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-200"
          >
            再取得
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void addTag();
          }}
          className="mt-4 flex items-center gap-2"
        >
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="追加するタグ名"
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400"
            disabled={isLoadingTags}
          />
          <button
            type="submit"
            disabled={isLoadingTags}
            className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            追加
          </button>
        </form>

        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3">
          {isLoadingTags ? (
            <p className="text-sm text-zinc-600">タグを読み込み中...</p>
          ) : taglist.length === 0 ? (
            <p className="text-sm text-zinc-600">タグはまだありません。</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {taglist.map((item) => (
                <span
                  key={item.id}
                  className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs text-zinc-700"
                >
                  #{item.tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-zinc-600">{tagStatusMessage}</p>
      </section>

      {/*貸出中ユーザ一覧*/}
      <section className="mt-8 max-w-xl rounded-lg border border-zinc-200 bg-zinc-50 p-5">
        <h2 className="text-lg font-semibold text-zinc-900">貸出中ユーザー一覧</h2>
        <div className="mt-4 space-y-4">
          {Object.entries(loanlist).length === 0 && (
            <p className="text-sm text-zinc-600">貸出中データはありません。</p>
          )}
          {Object.entries(loanlist).map(([userEmail, loans]) => (
            <div key={userEmail} className="rounded-md border border-zinc-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900">{userEmail}</p>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                  {loans[0]?.userTotalLoanCount ?? loans.length}冊
                </span>
              </div>
              <div className="space-y-2">
                {loans.map((loan) => {
                  const dueAt = loan.dueAt ? new Date(loan.dueAt) : null;
                  const overdueDaysSigned = dueAt
                    ? Math.round(
                        (toJstDateStartMs(dueAt) - toJstDateStartMs(new Date())) / DAY_MS
                      )
                    : null;
                  const isOverdue = overdueDaysSigned !== null && overdueDaysSigned < 0;

                  return (
                    <div
                      key={loan.id}
                      className={`rounded border p-2 ${isOverdue
                        ? "border-red-200 bg-red-50 text-red-600"
                        : "border-zinc-200 bg-zinc-50 text-zinc-800"
                        }`}
                    >
                      <div className="flex gap-2">
                        <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100">
                          {loan.book_thumbnail ? (
                            <img
                              src={loan.book_thumbnail}
                              alt={loan.book_title}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="text-[10px] text-zinc-500">NO IMAGE</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{loan.book_title}</p>
                          <p className="text-xs">
                            貸出日: {new Date(loan.loanedAt).toLocaleDateString("ja-JP", { timeZone: JST_TIMEZONE })}
                          </p>
                          <p className="text-xs">
                            返却期限: {dueAt ? dueAt.toLocaleDateString("ja-JP", { timeZone: JST_TIMEZONE }) : "未設定"}
                          </p>
                          <p className="text-xs font-semibold">
                            {overdueDaysSigned === null
                              ? "返却期限なし"
                              : isOverdue
                                ? `${Math.abs(overdueDaysSigned)}日超過（期限切れ）`
                                : `あと${overdueDaysSigned}日`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>




      <p className="mt-4 max-w-xl text-xs text-zinc-600">{statusMessage}</p>

    </main>
  );
}
