import type { ReactNode } from "react";
import Link from "next/link";
import MobileHeader from "@/app/(user)/_components/MobileHeader";
import MobileTabBar from "@/app/(user)/_components/MobileTabBar";
import UserProfileModal from "@/app/(user)/_components/UserProfileModal";

import { getUserProfile } from "@/lib/user-profile";
import {
  BookListIcon,
  CommunityIcon,
  BorrowIcon,
  ReturnIcon,
  SettingIcon,
  AdminIcon,
  StatisticsIcon,
} from "@/app/(user)/_components/LibraryNavIcons";

type UserSidebarLayoutProps = {
  children: ReactNode;
  isAdmin: boolean;
  userName: string | null;
  userEmail: string | null;
  nickname?: string | null;
};

export default async function UserSidebarLayout({
  children,
  isAdmin,
  userName,
  userEmail,
}: UserSidebarLayoutProps) {
  const navLinkClass =
    "flex w-full items-center gap-3 rounded-xl bg-transparent px-4 py-3 text-base font-medium text-slate-600 transition hover:bg-white/70 hover:text-slate-800";
  const result = userEmail ? await getUserProfile(userEmail) : null;

  return (
    <div className="min-h-screen bg-[#edf0f7]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:border-r lg:border-[#e0e6f0] lg:bg-[#edf0f7] lg:p-4">
          <div className="flex h-full flex-col">
            <Link
              href="/"
              prefetch={false}
              className="mb-5 rounded-2xl px-4 py-3"
            >
              <h1 className="mt-2 text-xl font-semibold text-zinc-900">プロクラ図書</h1>
            </Link>

            <nav className="space-y-1 p-2">
              <Link href="/setting" prefetch={false} className={navLinkClass}>
                <SettingIcon className="shrink-0" />
                設定
              </Link>
              {isAdmin && (
                <Link href="/admin" prefetch={false} className={navLinkClass}>
                  <AdminIcon className="shrink-0" />
                  管理者はこちら
                </Link>
              )}
              <Link href="/book-list" prefetch={false} className={navLinkClass}>
                <BookListIcon className="shrink-0" />
                本一覧
              </Link>
              <Link href="/community" prefetch={false} className={navLinkClass}>
                <CommunityIcon className="shrink-0" />
                コミュニティ
              </Link>
              <Link href="/statistics" prefetch={false} className={navLinkClass}>
                <StatisticsIcon className="shrink-0" />
                統計
              </Link>

              <Link href="/loan/qr" prefetch={false} className={navLinkClass}>
                <BorrowIcon className="shrink-0" />
                本を借りる
              </Link>
              <Link href="/return" prefetch={false} className={navLinkClass}>
                <ReturnIcon className="shrink-0" />
                返却する
              </Link>
            </nav>
            <UserProfileModal
              avatarUrl={result?.avatarUrl ?? null}
              nickname={result?.nickname ?? null}
              userName={userName}
              userEmail={userEmail}

            />

          </div>
        </aside>

        <div className="min-w-0 space-y-4 p-4 pb-24 sm:p-5 sm:pb-24 lg:p-6 lg:pb-6">
          <MobileHeader />

          <main className="min-w-0 rounded-md border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/50 backdrop-blur sm:rounded-lg sm:p-6 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto">
            {children}
          </main>
        </div>
      </div>

      <MobileTabBar isAdmin={isAdmin} />
    </div>
  );
}
