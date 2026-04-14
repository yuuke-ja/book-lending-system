"use client";

import { useRouter } from "next/navigation";

export default function ThreadBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }

        router.push("/community");
      }}
      aria-label="戻る"
      title="戻る"
      className="inline-flex h-10 w-10 items-center justify-center text-lg font-semibold text-zinc-700"
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
    </button>
  );
}
