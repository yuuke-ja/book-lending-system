"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/spinner";

export default function DeleteNoticeSubmitButton({
  label,
}: {
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={pending ? `${label}を削除中` : `${label}を削除`}
      title={pending ? "削除中..." : "削除"}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Spinner className="size-4" aria-hidden="true" />
      ) : (
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
