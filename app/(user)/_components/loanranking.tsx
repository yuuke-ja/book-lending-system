import { loanranking } from "@/lib/ranking/loan";

type LoanRankingProps = {
  sectionId?: string;
};

function renderRankingBadge(ranking: number) {
  const colors = {
    1: {
      fill: "#c9920e",
      text: "text-amber-800",
    },
    2: {
      fill: "#8f99a8",
      text: "text-slate-700",
    },
    3: {
      fill: "#b56a3b",
      text: "text-orange-800",
    },
  } as const;

  const isTopThree = ranking === 1 || ranking === 2 || ranking === 3;
  const color = isTopThree
    ? colors[ranking as 1 | 2 | 3]
    : { fill: "#000000", text: "text-zinc-700" };

  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap text-[11px] font-semibold leading-none ${color.text}`}
    >
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 -960 960 960"
          className={`block h-3.5 w-3.5 shrink-0 ${isTopThree ? "opacity-100" : "opacity-0"}`}
          fill={color.fill}
          aria-hidden="true"
        >
          <path d="M200-160v-80h560v80H200Zm0-140-51-321q-2 0-4.5.5t-4.5.5q-25 0-42.5-17.5T80-680q0-25 17.5-42.5T140-740q25 0 42.5 17.5T200-680q0 7-1.5 13t-3.5 11l125 56 125-171q-11-8-18-21t-7-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820q0 15-7 28t-18 21l125 171 125-56q-2-5-3.5-11t-1.5-13q0-25 17.5-42.5T820-740q25 0 42.5 17.5T880-680q0 25-17.5 42.5T820-620q-2 0-4.5-.5t-4.5-.5l-51 321H200Zm68-80h424l26-167-105 46-133-183-133 183-105-46 26 167Zm212 0Z" />
        </svg>
      </span>
      <span className="ml-0.5 inline-block min-w-[20px] text-left">
        {ranking}位
      </span>
    </span>
  );
}

export default async function LoanRanking({
  sectionId = "loan-ranking",
}: LoanRankingProps) {
  const loading = false;
  let error: string | null = null;
  let ranking: Awaited<ReturnType<typeof loanranking>> = [];

  try {
    ranking = await loanranking();
  } catch (caughtError) {
    console.error("貸出ランキングの取得に失敗:", caughtError);
    error = "貸出ランキングの取得に失敗しました";
  }

  return (
    <section
      id={sectionId}
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500">
            LOAN RANKING
          </p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-900">
            貸出ランキング
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
            {ranking.map((item) => (
              <article
                key={item.bookId}
                className="flex w-[240px] shrink-0 gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:w-[280px]"
              >
                <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-zinc-500">NO IMAGE</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="flex h-4 w-10 shrink-0 items-center justify-start self-start">
                      {renderRankingBadge(item.ranking)}
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold text-zinc-900">
                      {item.title}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    本ID: {item.bookId}
                  </p>
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
