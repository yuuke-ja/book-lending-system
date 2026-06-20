import { Suspense } from "react";
import ReturnStatus from "@/app/(user)/_components/ReturnStatus";
import LoanRanking from "@/app/(user)/_components/loanranking";
import BorrowedBooksList from "@/app/(user)/_components/BorrowedBooksList";
import BorrowedList from "@/app/(user)/_components/BorrowedList";
import SectionLoadingFallback from "@/app/(user)/_components/SectionLoadingFallback";
import UserLoanRanking from "@/app/(user)/_components/Userloanranking";
import NoticeList from "@/app/(user)/_components/NoticeList";
import { getNotices } from "@/lib/notices/get-notices";

export default async function Home() {
  const notices = await getNotices();

  return (
    <section className="space-y-6">
      <NoticeList notices={notices} />

      <ReturnStatus />

      <BorrowedBooksList />

      <BorrowedList />

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
