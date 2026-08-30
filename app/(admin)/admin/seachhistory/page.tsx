import { Suspense } from "react";
import { getSearchHistory, getzerokSearchHistory } from "@/lib/search-history/get-search-history";
import { SearchHistorySwitcher } from "./_component/seachhistoryswitch";

export default function SearchHistoryPage() {
  return (
    <Suspense
      fallback={<p className="p-6 text-sm text-zinc-600">検索履歴を読み込み中...</p>}
    >
      <SearchHistoryContent />
    </Suspense>
  );
}

async function SearchHistoryContent() {
  const [allHistory, zeroHistory] = await Promise.all([
    getSearchHistory(),
    getzerokSearchHistory(),
  ]);

  return (
    <SearchHistorySwitcher
      allHistory={allHistory}
      zeroHistory={zeroHistory}
    />
  );
}
