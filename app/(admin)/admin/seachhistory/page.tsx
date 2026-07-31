import { getSearchHistory, getzerokSearchHistory } from "@/lib/search-history/get-search-history";
import { SearchHistorySwitcher } from "./_component/seachhistoryswitch";

export default async function searchHistory() {
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
