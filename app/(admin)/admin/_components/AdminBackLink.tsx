"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminBackLink() {
  const pathname = usePathname();

  if (pathname === "/admin") {
    return null;
  }

  return (
    <div className="w-full px-6 pt-4">
      <Link
        href="/admin"
        aria-label="管理者ページへ戻る"
        title="管理者ページへ戻る"
        className="inline-flex h-10 w-10 items-center justify-center text-slate-700 transition-colors hover:text-slate-950"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-5 w-5"
        >
          <path
            d="M12.5 5 7.5 10l5 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </div>
  );
}
