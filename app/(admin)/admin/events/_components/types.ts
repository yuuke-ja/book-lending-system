export type EventDashboardData = {
  windowMinutes: number;
  summary: {
    postViewCount: number;
    bookDetailViewCount: number;
    loanCount: number;
    uniqueUserCount: number;
  };
  paths: {
    postToBookDetailCount: number;
    postToLoanCount: number;
    threadLinkToBookDetailCount: number;
    bookDetailToLoanCount: number;
    avgPostToBookDetailSeconds: number | null;
    avgBookDetailToLoanSeconds: number | null;
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
