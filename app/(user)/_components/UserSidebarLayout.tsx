import type { ReactNode } from "react";
import Link from "next/link";
import MobileHeader from "@/app/(user)/_components/MobileHeader";
import MobileTabBar from "@/app/(user)/_components/MobileTabBar";
import UserProfileModal from "@/app/(user)/_components/UserProfileModal";
import AiChatModal from "@/app/(user)/_components/AiChatModal";

import { getUserProfile } from "@/lib/user-profile";
import {
  BookListIcon,
  AiChatIcon,
  CommunityIcon,
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
              className="mb-5 rounded-2xl px-4 py-3"
            >
              <h1 className="mt-2 text-xl font-semibold text-zinc-900">プロマス図書</h1>
            </Link>

            <nav className="space-y-1 p-2">
              <Link href="/setting" className={navLinkClass}>
                <SettingIcon className="shrink-0" />
                設定
              </Link>
              {isAdmin && (
                <Link href="/admin" className={navLinkClass}>
                  <AdminIcon className="shrink-0" />
                  管理者はこちら
                </Link>
              )}
              <Link href="/book-list" className={navLinkClass}>
                <BookListIcon className="shrink-0" />
                本一覧
              </Link>
              <Link href="/ai-chat" className={navLinkClass}>
                <AiChatIcon className="shrink-0" />
                AIおすすめ
              </Link>
              <Link href="/community" className={navLinkClass}>
                <CommunityIcon className="shrink-0" />
                コミュニティ
              </Link>
              <Link href="/loan/qr" className={navLinkClass}>
                <BorrowIcon className="shrink-0" />
                本を借りる
              </Link>
              <Link href="/return" className={navLinkClass}>
                <ReturnIcon className="shrink-0" />
                返却する
              </Link>
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSfmUtl-W-PRoh4hYBsrVTZnveuchA9d4thp0N1JFzMK0AIw-A/viewform?usp=header"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-3 rounded-xl bg-blue-600 px-4 py-3 text-base font-medium text-white transition hover:bg-blue-700"
              >
                要望フォーム
              </a>
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
          <MobileHeader
            avatarUrl={result?.avatarUrl ?? null}
            nickname={result?.nickname ?? null}
            userName={userName}
            userEmail={userEmail}
          />

          <main className="min-w-0 rounded-md border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/50 backdrop-blur sm:rounded-lg sm:p-6 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto">
            {children}
          </main>
        </div>
      </div>

      <MobileTabBar isAdmin={isAdmin} />
      <AiChatModal />
    </div>
  );
}
