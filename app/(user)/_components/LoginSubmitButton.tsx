"use client";

import { useFormStatus } from "react-dom";

export default function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
    >
      {pending ? "移動中..." : "Googleでログイン"}
    </button>
  );
}
