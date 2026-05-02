import type { EventDashboardData } from "./types";

type EventActivityProps = {
  data: EventDashboardData;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  post_view: "投稿閲覧",
  book_detail_view: "本詳細閲覧",
  loan: "貸出",
  book_link_click: "投稿内リンク",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  thread: "投稿",
  comment: "コメント",
  direct: "直接",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function EventActivity({ data }: EventActivityProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">閲覧ランキング</h2>
          <p className="mt-1 text-sm text-zinc-600">
            本詳細閲覧が多い本の上位です。
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {data.ranking.length ? (
            data.ranking.map((item, index) => (
              <article
                key={`${item.bookId ?? "unknown"}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">
                    {index + 1}位 {item.title ?? "タイトルなし"}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {item.bookId ?? "bookIdなし"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-zinc-900">
                  {item.viewCount.toLocaleString("ja-JP")}閲覧
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500">
              閲覧データはありません。
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">最近の行動ログ</h2>
          <p className="mt-1 text-sm text-zinc-600">
            新しいイベントから順に20件表示します。
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold text-zinc-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">時刻</th>
                  <th className="whitespace-nowrap px-4 py-3">行動</th>
                  <th className="whitespace-nowrap px-4 py-3">ユーザー</th>
                  <th className="whitespace-nowrap px-4 py-3">本</th>
                  <th className="whitespace-nowrap px-4 py-3">経路</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {data.recentLogs.length ? (
                  data.recentLogs.map((log) => (
                    <tr key={log.id} className="text-zinc-700">
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatDateTime(log.occurredAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-900">
                        {EVENT_TYPE_LABELS[log.eventType] ?? log.eventType}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {log.userEmail ?? "-"}
                      </td>
                      <td className="min-w-52 px-4 py-3">
                        <p className="font-medium text-zinc-900">
                          {log.bookTitle ?? "本なし"}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {log.bookId ?? "bookIdなし"}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {log.sourceType
                          ? SOURCE_TYPE_LABELS[log.sourceType] ?? log.sourceType
                          : "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                      行動ログはありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
