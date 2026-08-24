import "server-only";

import { db } from "@/lib/db";

import { findTagCandidatesFromHistory } from "./tag-candidates-from-history";
import { findTagCandidatesFromSearchHistory } from "./tag-candidates-from-search-history";
import { findCandidatesFromHistory } from "./vector-candidates-from-history";
import { findCandidatesFromSearchHistory } from "./vector-candidates-from-search-history";

export type RecommendBook = {
  // おすすめ候補の本ID
  bookId: string;
  // 何個の履歴から同じ本が候補に出たか
  recommendBookCount: number;
  // この候補が出た元の履歴の中で一番新しい日時
  recommendBookLatestHistoryAt: Date;
  // ベクトル距離。小さいほど元の履歴の本に近い
  recommendBookDistance: number;
};

type TagRecommendBook = {
  bookId: string;
  tagCandidateCount: number;
  tagLatestHistoryAt: Date;
};

type RecommendBookScoreMetrics = {
  recommendBookScoreByBookId: Map<string, number>;
};

function createVectorRecommendBookScoreMetrics(
  recommendBooks: RecommendBook[]
): RecommendBookScoreMetrics {
  // 3つの観点で順位点を付け、bookIdごとの合計点を作る
  const recommendBookScoreByBookId = new Map<string, number>();
  addRecommendBookCountScore(recommendBookScoreByBookId, recommendBooks);
  addRecommendBookLatestHistoryScore(recommendBookScoreByBookId, recommendBooks);
  addRecommendBookDistanceScore(recommendBookScoreByBookId, recommendBooks);
  return { recommendBookScoreByBookId };
}

function createTagRecommendBookScoreMetrics(
  tagRecommendBooks: TagRecommendBook[]
): RecommendBookScoreMetrics {
  const recommendBookScoreByBookId = new Map<string, number>();
  addTagCandidateCountScore(recommendBookScoreByBookId, tagRecommendBooks);
  return { recommendBookScoreByBookId };
}

function addRecommendBookCountScore(
  recommendBookScoreByBookId: Map<string, number>,
  recommendBooks: RecommendBook[]
) {
  // 候補に出た回数が多い本ほど高得点にする
  const recommendBookCountRanking = recommendBooks.slice().sort((first, second) => {
    if (second.recommendBookCount !== first.recommendBookCount) {
      return second.recommendBookCount - first.recommendBookCount;
    }
    if (second.recommendBookLatestHistoryAt !== first.recommendBookLatestHistoryAt) {
      return second.recommendBookLatestHistoryAt.getTime() - first.recommendBookLatestHistoryAt.getTime();
    }
    return first.recommendBookDistance - second.recommendBookDistance;
  });
  for (let index = 0; index < recommendBookCountRanking.length; index++) {
    if (index >= 8) {
      break;
    }
    const recommendBook = recommendBookCountRanking[index];
    const score = 8 - index;
    const currentRecommendBookScore = recommendBookScoreByBookId.get(recommendBook.bookId) ?? 0;
    recommendBookScoreByBookId.set(recommendBook.bookId, currentRecommendBookScore + score);
  }
}

function addRecommendBookLatestHistoryScore(
  recommendBookScoreByBookId: Map<string, number>,
  recommendBooks: RecommendBook[]
) {
  // より新しい履歴から出た候補ほど高得点にする
  const recommendBookLatestHistoryRanking = recommendBooks.slice().sort((first, second) => {
    if (second.recommendBookLatestHistoryAt !== first.recommendBookLatestHistoryAt) {
      return second.recommendBookLatestHistoryAt.getTime() - first.recommendBookLatestHistoryAt.getTime();
    }
    if (second.recommendBookCount !== first.recommendBookCount) {
      return second.recommendBookCount - first.recommendBookCount;
    }
    return first.recommendBookDistance - second.recommendBookDistance;
  });

  for (let index = 0; index < recommendBookLatestHistoryRanking.length; index++) {
    if (index >= 8) {
      break;
    }
    const recommendBook = recommendBookLatestHistoryRanking[index];
    const score = 8 - index;
    const currentRecommendBookScore = recommendBookScoreByBookId.get(recommendBook.bookId) ?? 0;
    recommendBookScoreByBookId.set(recommendBook.bookId, currentRecommendBookScore + score);
  }
}

function addRecommendBookDistanceScore(
  recommendBookScoreByBookId: Map<string, number>,
  recommendBooks: RecommendBook[]
) {
  // ベクトル距離が近い本ほど高得点にする
  const recommendBookDistanceRanking = recommendBooks.slice().sort((first, second) => {
    if (second.recommendBookDistance !== first.recommendBookDistance) {
      return first.recommendBookDistance - second.recommendBookDistance;
    }
    if (second.recommendBookCount !== first.recommendBookCount) {
      return second.recommendBookCount - first.recommendBookCount;
    }
    return second.recommendBookLatestHistoryAt.getTime() - first.recommendBookLatestHistoryAt.getTime();
  });

  for (let index = 0; index < recommendBookDistanceRanking.length; index++) {
    if (index >= 8) {
      break;
    }
    const recommendBook = recommendBookDistanceRanking[index];

    const score = 8 - index;
    const currentRecommendBookScore = recommendBookScoreByBookId.get(recommendBook.bookId) ?? 0;
    recommendBookScoreByBookId.set(recommendBook.bookId, currentRecommendBookScore + score);
  }
}

function addTagCandidateCountScore(
  recommendBookScoreByBookId: Map<string, number>,
  tagRecommendBooks: TagRecommendBook[]
) {
  // 同じジャンルから候補に出た回数が多い本ほど高得点にする
  const tagCandidateCountRanking = tagRecommendBooks.slice().sort((first, second) => {
    if (second.tagCandidateCount !== first.tagCandidateCount) {
      return second.tagCandidateCount - first.tagCandidateCount;
    }
    return second.tagLatestHistoryAt.getTime() - first.tagLatestHistoryAt.getTime();
  });

  for (let index = 0; index < tagCandidateCountRanking.length; index++) {
    if (index >= 8) {
      break;
    }
    const tagRecommendBook = tagCandidateCountRanking[index];
    const score = 8 - index;
    const currentRecommendBookScore = recommendBookScoreByBookId.get(tagRecommendBook.bookId) ?? 0;
    recommendBookScoreByBookId.set(tagRecommendBook.bookId, currentRecommendBookScore + score);
  }
}

function getRecommendBookScore(
  bookId: string,
  metrics: RecommendBookScoreMetrics | null
) {
  return metrics?.recommendBookScoreByBookId.get(bookId) ?? 0;
}

function getLatestHistoryAt(
  recommendBook: RecommendBook | undefined,
  tagRecommendBook: TagRecommendBook | undefined
) {
  if (recommendBook && tagRecommendBook) {
    return new Date(
      Math.max(
        recommendBook.recommendBookLatestHistoryAt.getTime(),
        tagRecommendBook.tagLatestHistoryAt.getTime()
      )
    );
  }
  return recommendBook?.recommendBookLatestHistoryAt ?? tagRecommendBook?.tagLatestHistoryAt;
}

export async function generateRecommendations(
  userEmail: string
): Promise<RecommendBook[]> {
  const historyCandidates = await findCandidatesFromHistory(userEmail);

  const [tagCandidates, tagSearchCandidates] = await Promise.all([
    findTagCandidatesFromHistory(userEmail),
    findTagCandidatesFromSearchHistory(userEmail),
  ]);

  let searchHistoryCandidates: Awaited<
    ReturnType<typeof findCandidatesFromSearchHistory>
  > = [];

  try {
    searchHistoryCandidates = await findCandidatesFromSearchHistory(userEmail);
  } catch (error) {
    console.error("検索履歴からのおすすめ候補取得に失敗:", error);
  }

  const vectorResults = [...historyCandidates, ...searchHistoryCandidates];
  const tagresults = [...tagCandidates, ...tagSearchCandidates];
  const recommendBooks = new Map<string, RecommendBook>();
  const tagRecommendBooks = new Map<string, TagRecommendBook>();

  // 同じ本が複数の履歴から候補に出た場合、1つにまとめて評価材料を更新する
  for (const result of vectorResults) {
    const current = recommendBooks.get(result.bookId);
    if (!current) {
      recommendBooks.set(result.bookId, {
        bookId: result.bookId,
        recommendBookCount: 1,
        recommendBookLatestHistoryAt: result.occurredAt,
        recommendBookDistance: result.distance,
      });
      continue;
    }
    current.recommendBookCount += 1;
    // その本が候補に出た履歴の中で、一番新しい日時を残す
    if (result.occurredAt > current.recommendBookLatestHistoryAt) {
      current.recommendBookLatestHistoryAt = result.occurredAt;
    }
    // その本が候補に出た中で、一番近いベクトル距離を残す
    if (result.distance < current.recommendBookDistance) {
      current.recommendBookDistance = result.distance;
    }
  }

  for (const result of tagresults) {
    const current = tagRecommendBooks.get(result.bookId);
    if (!current) {
      tagRecommendBooks.set(result.bookId, {
        bookId: result.bookId,
        tagCandidateCount: 1,
        tagLatestHistoryAt: result.occurredAt,
      });
      continue;
    }
    current.tagCandidateCount += 1;
    if (result.occurredAt > current.tagLatestHistoryAt) {
      current.tagLatestHistoryAt = result.occurredAt;
    }
  }

  const recommendBookList = Array.from(recommendBooks.values());
  const tagRecommendBookList = Array.from(tagRecommendBooks.values());
  const vectorScoreMetrics =
    recommendBookList.length > 0
      ? createVectorRecommendBookScoreMetrics(recommendBookList)
      : null;
  const tagScoreMetrics =
    tagRecommendBookList.length > 0
      ? createTagRecommendBookScoreMetrics(tagRecommendBookList)
      : null;
  const allBookIds = new Set([
    ...recommendBooks.keys(),
    ...tagRecommendBooks.keys(),
  ]);

  // 合計点が高い順に並べ、同点なら回数新しさ距離で並べる
  const rankedRecommendBooks = Array.from(allBookIds)
    .map((bookId) => {
      const recommendBook = recommendBooks.get(bookId);
      const tagRecommendBook = tagRecommendBooks.get(bookId);
      const recommendBookLatestHistoryAt = getLatestHistoryAt(
        recommendBook,
        tagRecommendBook
      );
      if (!recommendBookLatestHistoryAt) {
        throw new Error("おすすめ候補の履歴日時が取得できません");
      }
      return {
        bookId,
        recommendBookCount:
          (recommendBook?.recommendBookCount ?? 0) +
          (tagRecommendBook?.tagCandidateCount ?? 0),
        recommendBookLatestHistoryAt,
        recommendBookDistance: recommendBook?.recommendBookDistance ?? 1,
      };
    })
    .sort((first, second) => {
      const firstScore =
        getRecommendBookScore(first.bookId, vectorScoreMetrics) +
        getRecommendBookScore(first.bookId, tagScoreMetrics) * 2;
      const secondScore =
        getRecommendBookScore(second.bookId, vectorScoreMetrics) +
        getRecommendBookScore(second.bookId, tagScoreMetrics) * 2;
      const scoreDifference = secondScore - firstScore;
      if (scoreDifference !== 0) {
        return scoreDifference;
      }
      if (second.recommendBookCount !== first.recommendBookCount) {
        return second.recommendBookCount - first.recommendBookCount;
      }
      const occurredAtDifference =
        second.recommendBookLatestHistoryAt.getTime() - first.recommendBookLatestHistoryAt.getTime();
      if (occurredAtDifference !== 0) {
        return occurredAtDifference;
      }
      return first.recommendBookDistance - second.recommendBookDistance;
    })
    .slice(0, 8);

  // ユーザーごとのおすすめは毎回作り直す。
  await db.transaction(async (tx) => {
    await tx.query(
      `
      SELECT pg_advisory_xact_lock(hashtext($1))
      `,
      [userEmail]
    );
    await tx.query(
      `
      DELETE FROM "UserRecommendation"
       WHERE "userEmail" = $1
      `,
      [userEmail]
    );
    if (rankedRecommendBooks.length === 0) {
      return;
    }
    await tx.query(
      `
      INSERT INTO "UserRecommendation" (
        "userEmail",
        "bookId",
        rank,
        "candidateCount",
        distance,
        "latestHistoryAt"
      )
      SELECT
       $1,
       input."bookId",
       input.rank,
       input."candidateCount",
       input.distance,
       input."latestHistoryAt"
      FROM unnest( $2::text[], $3::integer[], $4::integer[], $5::double precision[], $6::timestamp[])
      AS input(
        "bookId",rank,"candidateCount",distance,"latestHistoryAt"
       )
      `,
      [
        userEmail,
        rankedRecommendBooks.map((recommendBook) => recommendBook.bookId),
        rankedRecommendBooks.map((_, index) => index + 1),
        rankedRecommendBooks.map((recommendBook) => recommendBook.recommendBookCount),
        rankedRecommendBooks.map((recommendBook) => recommendBook.recommendBookDistance),
        rankedRecommendBooks.map((recommendBook) => recommendBook.recommendBookLatestHistoryAt),
      ]
    );
  });
  return rankedRecommendBooks;
}
