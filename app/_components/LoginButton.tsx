"use client";

import { signIn } from "next-auth/react";

export default function LoginButton() {
  return (
    <button
      className="rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800"
      onClick={() => signIn("google", { callbackUrl: "/" })}
    >
      Googleでログイン
    </button>
  );
}
