"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookListIcon,
  BorrowIcon,
  ReturnIcon,
  SettingIcon,
} from "@/app/(user)/_components/LibraryNavIcons";

type TabItem = {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
  Icon: ComponentType<{ className?: string }>;
};

const tabs: TabItem[] = [
  {
    href: "/book-list",
    label: "本一覧",
    isActive: (pathname) =>
      pathname === "/book-list" || pathname.startsWith("/book-list/"),
    Icon: BookListIcon,
  },
  {
    href: "/loan/qr",
    label: "借りる",
    isActive: (pathname) => pathname === "/loan/qr" || pathname.startsWith("/loan/"),
    Icon: BorrowIcon,
  },
  {
    href: "/return",
    label: "返却",
    isActive: (pathname) => pathname === "/return" || pathname.startsWith("/return/"),
    Icon: ReturnIcon,
  },
  {
    href: "/setting",
    label: "設定",
    isActive: (pathname) => pathname === "/setting" || pathname.startsWith("/setting/"),
    Icon: SettingIcon,
  },
];

export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe5ee] bg-white/95 shadow-[0_-12px_24px_-22px_rgba(15,23,42,0.45)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 px-2 pt-0.5 pb-[calc(0.45rem+env(safe-area-inset-bottom))]">
        {tabs.map(({ href, label, isActive, Icon }) => {
          const active = isActive(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 pb-1 pt-2 text-[11px] font-medium tracking-[-0.01em] transition-colors ${
                active ? "text-[#167fcf]" : "text-[#6f7888] hover:text-[#4f5764]"
              }`}
            >
              <span
                className={`absolute left-2 right-2 top-0 h-[2px] rounded-full ${
                  active ? "bg-[#67b7ea]" : "bg-transparent"
                }`}
              />
              <Icon className={active ? "h-6 w-6 text-[#167fcf]" : "h-6 w-6 text-[#6f7888]"} />
              <span className="leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
