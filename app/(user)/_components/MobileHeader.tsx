"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import UserProfileModal from "@/app/(user)/_components/UserProfileModal";

type PageMeta = {
  eyebrow: string;
  title: string;
  description: string;
};

function getPageMeta(pathname: string): PageMeta {
  if (pathname === "/") {
    return {
      eyebrow: "HOME",
      title: "プロクラ図書",
      description: "図書貸出ホーム",
    };
  }

  if (pathname === "/book-list" || pathname.startsWith("/book-list/")) {
    return {
      eyebrow: "BOOKS",
      title: "本一覧",
      description: "登録済みの本を確認",
    };
  }

  if (pathname === "/loan/qr" || pathname.startsWith("/loan/")) {
    return {
      eyebrow: "LOAN",
      title: "本を借りる",
      description: "ISBN/JANを読み取って貸出",
    };
  }

  if (pathname === "/statistics" || pathname.startsWith("/statistics/")) {
    return {
      eyebrow: "STATISTICS",
      title: "統計",
      description: "利用状況を確認",
    };
  }

  if (pathname === "/return" || pathname.startsWith("/return/")) {
    return {
      eyebrow: "RETURN",
      title: "返却する",
      description: "ISBN/JANを読み取って返却",
    };
  }

  if (pathname === "/setting" || pathname.startsWith("/setting/")) {
    return {
      eyebrow: "SETTINGS",
      title: "通知設定",
      description: "プッシュ通知の受け取りを切り替え",
    };
  }

  return {
    eyebrow: "LIBRARY",
    title: "プロクラ図書",
    description: "図書貸出システム",
  };
}

type MobileHeaderProps = {
  avatarUrl: string | null;
  userName: string | null;
  userEmail: string | null;
  nickname?: string | null;
};

export default function MobileHeader({
  avatarUrl,
  userName,
  userEmail,
  nickname,
}: MobileHeaderProps) {
  const pathname = usePathname();
  const pageMeta = getPageMeta(pathname);

  return (
    <>
      <div
        aria-hidden="true"
        className="h-[calc(4rem+env(safe-area-inset-top))] lg:hidden"
      />
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/70 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.8)] backdrop-blur-md lg:hidden">
        <div className="mx-auto h-16 px-4 pt-[env(safe-area-inset-top)]">
          <div className="relative flex h-full items-center justify-between">
            <Link
              href="/"
              prefetch={false}
              className="inline-flex items-center gap-1 text-base font-semibold tracking-[0.04em] text-zinc-900 transition hover:text-sky-800"
            >
              プロクラ図書
            </Link>

            <div className="flex items-center gap-3">
              <span className="max-w-[96px] truncate text-xs font-medium text-zinc-500">
                {pageMeta.title}
              </span>
              <UserProfileModal
                avatarUrl={avatarUrl}
                nickname={nickname}
                userName={userName}
                userEmail={userEmail}
                triggerClassName="rounded-full"
                triggerImageClassName="h-10 w-10 rounded-full border border-zinc-200 bg-zinc-100 object-cover"
              />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
