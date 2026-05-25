export type EventDashboardData = {
  windowMinutes: number;
  summary: {
    postViewCount: number;
    bookDetailViewCount: number;
    loanCount: number;
    uniqueUserCount: number;
  };
  paths: {
    postToLoanCount: number;
    threadLinkClickCount: number;
    threadLinkClickToLoanCount: number;
    threadLinkClickToLoanRate: number;
    bookDetailToLoanCount: number;
    avgBookDetailToLoanSeconds: number | null;
    aiRecommendationCount: number;
    aiRecommendationToLoanCount: number;
    aiRecommendationToLoanRate: number;
    aiRecommendationDisplayToLoanCount: number;
    aiRecommendationDisplayToLoanRate: number;
    aiClickCount: number;
    aiClickRate: number;
  };
  ranking: {
    bookId: string | null;
    title: string | null;
    viewCount: number;
  }[];
  recentLogs: {
    id: string;
    occurredAt: string;
    eventType: string;
    userEmail: string | null;
    bookId: string | null;
    sourceType: string | null;
    sourceId: string | null;
    bookTitle: string | null;
  }[];
};
