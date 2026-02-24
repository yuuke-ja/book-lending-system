import type { ReactNode } from "react";
import Link from "next/link";
import SignOutButton from "@/app/(user)/_components/SignOutButton";
import MobileTabBar from "@/app/(user)/_components/MobileTabBar";
import {
  BookListIcon,
  BorrowIcon,
  ReturnIcon,
  SettingIcon,
  AdminIcon,
} from "@/app/(user)/_components/LibraryNavIcons";

type UserSidebarLayoutProps = {
  children: ReactNode;
  isAdmin: boolean;
  userName: string | null;
  userEmail: string | null;
};

export default function UserSidebarLayout({
  children,
  isAdmin,
  userName,
  userEmail,
}: UserSidebarLayoutProps) {
  const navLinkClass =
    "flex w-full items-center gap-3 rounded-xl bg-transparent px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-slate-800";

  return (
    <div className="min-h-screen bg-[#edf0f7]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:border-r lg:border-[#e0e6f0] lg:bg-[#edf0f7] lg:p-4">
          <div className="flex h-full flex-col">
            <Link
              href="/"
              className="mb-5 rounded-2xl px-4 py-3"
            >
              <h1 className="mt-2 text-xl font-semibold text-zinc-900">プロクラ図書</h1>
            </Link>

            <nav className="space-y-1 p-2">
              <Link href="/setting" className={navLinkClass}>
                <SettingIcon className="h-[18px] w-[18px] shrink-0 text-current" />
                設定
              </Link>
              {isAdmin && (
                <Link href="/admin" className={navLinkClass}>
                  <AdminIcon className="h-[18px] w-[18px] shrink-0 text-current" />
                  管理者はこちら
                </Link>
              )}
              <Link href="/book-list" className={navLinkClass}>
                <BookListIcon className="h-[18px] w-[18px] shrink-0 text-current" />
                本一覧
              </Link>

              <Link href="/loan/qr" className={navLinkClass}>
                <BorrowIcon className="h-[18px] w-[18px] shrink-0 text-current" />
                本を借りる
              </Link>
              <Link href="/return" className={navLinkClass}>
                <ReturnIcon className="h-[18px] w-[18px] shrink-0 text-current" />
                返却する
              </Link>
            </nav>

            <div className="mt-auto rounded-2xl border border-[#e3e8f2] bg-[#f4f6fb] p-4">
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-500">
                ACCOUNT
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-800">
                {userName || "ユーザー"}
              </p>
              {userEmail && <p className="text-xs text-slate-500">{userEmail}</p>}
              <SignOutButton className="mt-4 w-full rounded-xl bg-[#4a5977] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#42506b]" />
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-4 p-4 pb-24 sm:p-5 sm:pb-24 lg:p-6 lg:pb-6">


          <main className="min-w-0 rounded-md border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/50 backdrop-blur sm:rounded-lg sm:p-6 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto">
            {children}
          </main>
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}
