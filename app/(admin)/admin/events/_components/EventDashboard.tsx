import { useState } from "react";
import type { EventDashboardData } from "./types";

type EventDashboardProps = {
  data: EventDashboardData;
  isLoading: boolean;
  onApplyImpactTime: (url: string) => void;
};

export default function EventDashboard({
  data,
  isLoading,
  onApplyImpactTime,
}: EventDashboardProps) {

  function formatSeconds(value: number | null) {
    if (value == null) return "データなし";
    const totalSeconds = Math.round(value);
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];

    if (days > 0) parts.push(`${days}日`);
    if (hours > 0) parts.push(`${hours}時間`);
    if (minutes > 0) parts.push(`${minutes}分`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`);

    return parts.join("");
  }

  const [pathImpactTimes, setPathImpactTimes] = useState({
    postToBookDetail: { amount: "10", unit: "minutes" },
    postToLoan: { amount: "1", unit: "hours" },
    threadLinkToBookDetail: { amount: "5", unit: "seconds" },
    bookDetailToLoan: { amount: "30", unit: "minutes" },
  });

  const summaryItems = [
    { label: "投稿閲覧", value: data.summary.postViewCount },
    { label: "本詳細閲覧", value: data.summary.bookDetailViewCount },
    { label: "貸出数", value: data.summary.loanCount },
    { label: "利用者数", value: data.summary.uniqueUserCount },
  ];

  const pathItems = [
    {
      key: "postToBookDetail" as const,
      label: "投稿経由 → 本詳細",
      value: data.paths.postToBookDetailCount,
      detail: `平均 ${formatSeconds(data.paths.avgPostToBookDetailSeconds)}`,
    },
    {
      key: "postToLoan" as const,
      label: "投稿経由 → 貸出",
      value: data.paths.postToLoanCount,
      detail: "投稿閲覧から貸出まで",
    },
    {
      key: "threadLinkToBookDetail" as const,
      label: "投稿内リンク → 本詳細",
      value: data.paths.threadLinkToBookDetailCount,
      detail: "投稿・コメント内リンク",
    },
    {
      key: "bookDetailToLoan" as const,
      label: "本詳細 → 貸出",
      value: data.paths.bookDetailToLoanCount,
      detail: `平均 ${formatSeconds(data.paths.avgBookDetailToLoanSeconds)}`,
    },
  ];

  function paopop() {
    const url = `/api/admin/events/dashboard` +
      `?postToBookDetailImpactTime=${pathImpactTimes.postToBookDetail.amount}${pathImpactTimes.postToBookDetail.unit}` +
      `&postToLoanImpactTime=${pathImpactTimes.postToLoan.amount}${pathImpactTimes.postToLoan.unit}` +
      `&threadLinkToBookDetailImpactTime=${pathImpactTimes.threadLinkToBookDetail.amount}${pathImpactTimes.threadLinkToBookDetail.unit}` +
      `&bookDetailToLoanImpactTime=${pathImpactTimes.bookDetailToLoan.amount}${pathImpactTimes.bookDetailToLoan.unit}`;

    onApplyImpactTime(url);
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="flex min-h-44 w-56 max-w-full flex-none flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-zinc-500">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-900">
              {item.value.toLocaleString("ja-JP")}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">経路別</h2>
          <p className="mt-1 text-sm text-zinc-600">
            行動ログから集計した閲覧・貸出までの経路です。
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          {pathItems.map((item) => (
            <article
              key={item.key}
              className="flex min-h-72 w-72 max-w-full flex-none flex-col justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
            >
              <div>
                <p className="text-sm font-medium text-zinc-600">
                  {item.label}
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-950">
                  {item.value.toLocaleString("ja-JP")}
                </p>
                <p className="mt-2 text-xs text-zinc-500">{item.detail}</p>
              </div>

              <div className="mt-5 border-t border-zinc-200 pt-4">
                <p className="text-xs font-semibold text-zinc-500">影響時間</p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    min={1}
                    value={pathImpactTimes[item.key].amount}
                    onChange={(event) =>
                      setPathImpactTimes((current) => ({
                        ...current,
                        [item.key]: {
                          ...current[item.key],
                          amount: event.target.value,
                        },
                      }))
                    }
                    className="h-10 w-24 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    aria-label={`${item.label}の影響時間`}
                  />
                  <select
                    value={pathImpactTimes[item.key].unit}
                    onChange={(event) =>
                      setPathImpactTimes((current) => ({
                        ...current,
                        [item.key]: {
                          ...current[item.key],
                          unit: event.target.value,
                        },
                      }))
                    }
                    className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    aria-label={`${item.label}の影響時間単位`}
                  >
                    <option value="seconds">秒</option>
                    <option value="minutes">分</option>
                    <option value="hours">時間</option>
                    <option value="days">日</option>
                  </select>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={paopop}
            disabled={isLoading}
            className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            この条件で再集計
          </button>
          <p className="text-sm text-zinc-500">
            4つの影響時間をまとめて適用します。
          </p>
        </div>
      </section>
    </div>
  );
}
