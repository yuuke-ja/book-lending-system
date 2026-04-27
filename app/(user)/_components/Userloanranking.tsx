import { userranking } from "@/lib/ranking/user";
export default async function UserLoanRanking() {
  const loading = false;
  let error: string | null = null;
  let ranking: Awaited<ReturnType<typeof userranking>> = [];

  try {
    ranking = await userranking();
  } catch (caughtError) {
    console.error("貸出ユーザーランキングの取得に失敗:", caughtError);
    error = "貸出ユーザーランキングの取得に失敗しました";
  }
  return (
    <section
      id={"user-loan-ranking"}
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500">
            LOAN RANKING
          </p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-900">
            貸出ユーザーランキング
          </h3>
        </div>
        {!loading && !error && (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            TOP {ranking.length}
          </span>
        )}
      </div>

      {loading && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          読み込み中...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && ranking.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          ランキングデータがありません。
        </div>
      )}

      {!loading && !error && ranking.length > 0 && (
        <div className="overflow-x-auto pb-2">
          <div className="flex w-max gap-4">
            {ranking.map((item, index) => (
              <article
                key={item.userId ?? `loan-user-ranking-${index}`}
                className="flex w-[240px] shrink-0 gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:w-[280px]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100">

                  {item.avatarUrl ? (
                    <img
                      src={item.avatarUrl}
                      alt={item.nickname ?? "未設定"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src="/default-avatar.svg"
                      alt={item.nickname ?? "未設定"}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="shrink-0 text-[11px] font-semibold text-zinc-700">
                      {item.ranking}位
                    </p>
                    <p className="line-clamp-2 text-sm font-semibold text-zinc-900">
                      {item.nickname || "未設定"}
                    </p>
                  </div>
                  <p className="mt-3 text-sm font-medium text-zinc-700">
                    貸出 {item.loanCount}回
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
