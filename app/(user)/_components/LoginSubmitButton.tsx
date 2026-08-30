"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/spinner";

export default function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-w-40 items-center justify-center gap-2 rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
    >
      {pending ? (
        <>
          <Spinner aria-hidden="true" />
          移動中...
        </>
      ) : (
        "Googleでログイン"
      )}
    </button>
  );
}
