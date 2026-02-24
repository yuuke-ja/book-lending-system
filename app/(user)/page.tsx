import ReturnStatus from "@/app/(user)/_components/ReturnStatus";
import BorrowedBooksList from "@/app/(user)/_components/BorrowedBooksList";
import BorrowedList from "@/app/(user)/_components/BorrowedList";
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/book-list"
          className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500">
            BOOKS
          </p>
          <p className="mt-2 text-lg font-semibold text-zinc-900">本一覧</p>
          <p className="mt-1 text-sm text-zinc-600">登録済みの本を確認</p>
        </Link>

        <Link
          href="/loan/qr"
          className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs font-semibold tracking-[0.14em] text-emerald-700">
            LOAN
          </p>
          <p className="mt-2 text-lg font-semibold text-zinc-900">本を借りる</p>
          <p className="mt-1 text-sm text-zinc-600">ISBNを読み取って貸出</p>
        </Link>

        <Link
          href="/return"
          className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs font-semibold tracking-[0.14em] text-amber-700">
            RETURN
          </p>
          <p className="mt-2 text-lg font-semibold text-zinc-900">返却する</p>
          <p className="mt-1 text-sm text-zinc-600">ISBNを読み取って返却</p>
        </Link>
      </div>
    </section>
  );
}
