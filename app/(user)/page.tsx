import { Suspense } from "react";
import ReturnStatus from "@/app/(user)/_components/ReturnStatus";
import LoanRanking from "@/app/(user)/_components/loanranking";
import BorrowedBooksList from "@/app/(user)/_components/BorrowedBooksList";
import BorrowedList from "@/app/(user)/_components/BorrowedList";
import RecommendedBooksList from "@/app/(user)/_components/RecommendedBooksList";
import SectionLoadingFallback from "@/app/(user)/_components/SectionLoadingFallback";
import UserLoanRanking from "@/app/(user)/_components/Userloanranking";
import NoticeList from "@/app/(user)/_components/NoticeList";
import { getNotices } from "@/lib/notices/get-notices";

async function NoticesSection() {
  const notices = await getNotices();

  return <NoticeList notices={notices} />;
}

export default function Home() {
  return (
    <section className="space-y-6">
      <Suspense
        fallback={
          <SectionLoadingFallback label="NOTICES" title="お知らせ" />
        }
      >
        <NoticesSection />
      </Suspense>

      <ReturnStatus />

      <Suspense
        fallback={
          <SectionLoadingFallback
            label="BORROWED BOOKS"
            title="現在借りている本"
          />
        }
      >
        <BorrowedBooksList />
      </Suspense>

      <Suspense
        fallback={
          <SectionLoadingFallback
            label="RECOMMENDED BOOKS"
            title="あなたにおすすめの本"
          />
        }
      >
        <RecommendedBooksList />
      </Suspense>

      <Suspense
        fallback={
          <SectionLoadingFallback label="LOAN HISTORY" title="貸出履歴" />
        }
      >
        <BorrowedList sectionId="loan-history" />
      </Suspense>

      <Suspense
        fallback={
          <SectionLoadingFallback
            label="LOAN RANKING"
            title="貸出ランキング"
          />
        }
      >
        <LoanRanking />
      </Suspense>

      <Suspense
        fallback={
          <SectionLoadingFallback
            label="LOAN RANKING"
            title="貸出ユーザーランキング"
          />
        }
      >
        <UserLoanRanking />
      </Suspense>

    </section>
  );
}
