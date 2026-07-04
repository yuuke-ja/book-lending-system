import "server-only";

import { generateRecommendations } from "./generate-recommendations";
import { getUserRecommendations } from "./get-user-recommendations";
import { shouldRefreshRecommendations } from "./should-refresh-recommendations";

export async function refreshAndGetUserRecommendations(userEmail: string) {
  // ユーザーの最新行動・検索履歴が、保存済みおすすめより新しければ再生成する
  const shouldRefresh = await shouldRefreshRecommendations(userEmail);

  if (shouldRefresh) {
    try {
      // 再生成に失敗してもホーム画面自体は落とさず、保存済みのおすすめを返す
      await generateRecommendations(userEmail);
    } catch (error) {
      console.error("おすすめ本の更新に失敗:", error);
    }
  }

  // ホーム表示用に、保存済みのおすすめ本をrank順で取得する
  return getUserRecommendations(userEmail);
}
