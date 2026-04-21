"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import SingOutButton from "@/app/(user)/_components/SignOutButton";
import Link from "next/link";
import { SettingIcon, } from "@/app/(user)/_components/LibraryNavIcons";

type UserProfileModalProps = {
  avatarUrl: string | null;
  userName: string | null;
  userEmail: string | null;
  nickname?: string | null;
  triggerClassName?: string;
  triggerImageClassName?: string;
};

export default function UserProfileModal({
  avatarUrl,
  userName,
  userEmail,
  nickname,
  triggerClassName,
  triggerImageClassName,
}: UserProfileModalProps) {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const dialogTitleId = useId();
  const isBrowser = typeof document !== "undefined";

  useEffect(() => {
    if (!isProfileModalOpen || !isBrowser) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isProfileModalOpen, isBrowser]);

  return (
    <>
      <button
        type="button"
        className={triggerClassName ?? "mt-auto w-fit rounded-full"}
        onClick={() => setIsProfileModalOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isProfileModalOpen}
      >
        <img
          src={avatarUrl || "/default-avatar.svg"}
          alt={userName || "ユーザー"}
          className={triggerImageClassName ?? "h-16 w-16 rounded-full object-cover"}
        />
      </button>

      {isProfileModalOpen &&
        isBrowser &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setIsProfileModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
          >
            <div
              className="h-[600px] w-[400px] max-w-md rounded-lg bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <Link
                  href="/setting"
                  className="flex items-center justify-start text-slate-600 transition hover:text-slate-800"
                  prefetch={false}
                  onClick={() => setIsProfileModalOpen(false)}
                  aria-label="設定"
                >
                  <SettingIcon className="shrink-0" />
                </Link>
                <button
                  type="button"
                  className="text-2xl leading-none text-slate-500 transition hover:text-slate-800"
                  onClick={() => setIsProfileModalOpen(false)}
                  aria-label="閉じる"
                >
                  ×
                </button>
              </div>
              <img
                src={avatarUrl || "/default-avatar.svg"}
                alt={userName || "ユーザー"}
                className="mx-auto mb-4 h-24 w-24 rounded-full object-cover"
              />
              <p className="text-center text-sm text-gray-500">ユーザー名</p>
              <h2 id={dialogTitleId} className="text-center text-xl font-semibold">
                {userName || "ユーザー"}
              </h2>
              <p className="text-center text-sm text-gray-500">ニックネーム</p>
              <p className="text-center text-lg font-medium">{nickname || "未設定"}</p>

              {userEmail && (
                <p className="text-center text-sm text-gray-500">{userEmail}</p>
              )}
              <SingOutButton className="mt-4 w-full rounded-xl bg-[#4a5977] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#42506b]" />

            </div>
          </div>,
          document.body
        )}
    </>
  );
}
