"use client";

import { useState } from "react";
import AiBookChat from "@/app/(user)/_components/AiBookChat";
import { AiChatIcon } from "@/app/(user)/_components/LibraryNavIcons";

export default function AiChatModal() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const openChat = () => {
    setHasOpened(true);
    setOpen(true);
  };

  return (
    <>
      {hasOpened && (
        <div
          className={`fixed bottom-24 right-4 z-50 h-[min(650px,calc(100dvh_-_7rem))] w-[min(calc(100vw-2rem),420px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${
            open ? "flex" : "hidden"
          }`}
          aria-hidden={!open}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">AIおすすめ</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              閉じる
            </button>
          </div>
          <AiBookChat className="h-auto flex-1 rounded-none border-0" />
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={openChat}
          className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl transition hover:bg-blue-700"
          aria-label="AIおすすめを開く"
        >
          <AiChatIcon className="h-7 w-7" />
        </button>
      )}
    </>
  );
}
