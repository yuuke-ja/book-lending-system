import type { ReactNode } from "react";
import Link from "next/link";
import SignOutButton from "@/app/(user)/_components/SignOutButton";

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
    "flex w-full items-center rounded-xl bg-transparent px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-slate-800";

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
                設定
              </Link>
              {isAdmin && (
                <Link href="/admin" className={navLinkClass}>
                  管理者はこちら
                </Link>
              )}
              <Link href="/book-list" className={navLinkClass}>
                本一覧
              </Link>

              <Link href="/loan/qr" className={navLinkClass}>
                本を借りる
              </Link>
              <Link href="/return" className={navLinkClass}>
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
          <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
            <p className="text-xs font-semibold tracking-[0.16em] text-sky-700">
              PROCLA LIBRARY
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              スマホ版（下部タブで移動）
            </p>
          </div>

          <main className="min-w-0 rounded-2xl border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/50 backdrop-blur sm:rounded-3xl sm:p-6">
            {children}
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/80 bg-white/95 p-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
          <Link
            href="/book-list"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-800 shadow-sm"
          >
            本一覧
          </Link>
          <Link
            href="/loan/qr"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700 shadow-sm"
          >
            本を借りる
          </Link>
        </div>
      </nav>
    </div>
  );
}
