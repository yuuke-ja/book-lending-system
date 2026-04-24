import ReturnStatus from "@/app/(user)/_components/ReturnStatus";
import LoanRanking from "@/app/(user)/_components/loanranking";
import BorrowedBooksList from "@/app/(user)/_components/BorrowedBooksList";
import BorrowedList from "@/app/(user)/_components/BorrowedList";
import UserLoanRanking from "@/app/(user)/_components/Userloanranking";
import Link from "next/link";
export default async function Home() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_70%,#fef9c3_100%)] p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold tracking-[0.16em] text-sky-700">
          HOME
        </p>
        <h2 className="mt-2 text-xl font-semibold text-zinc-900 sm:text-2xl">
          図書貸出ホーム
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          PCは左サイドバー、スマホは下部タブから画面を切り替えます。中央エリアに各ページの内容が表示されます。
        </p>
      </div>

      <ReturnStatus />

      <BorrowedBooksList />

      <BorrowedList />

      <LoanRanking />

      <UserLoanRanking />




    </section>
  );
}
