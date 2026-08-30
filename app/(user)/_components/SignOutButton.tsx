"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/spinner";
import { handleSignOut } from "@/lib/action/signout";

type SignOutButtonProps = {
  className?: string;
};

export default function SignOutButton({ className }: SignOutButtonProps) {
  return (
    <form action={handleSignOut}>
      <SignOutSubmitButton className={className} />
    </form>
  );
}

function SignOutSubmitButton({ className }: SignOutButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className ?? ""} inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? (
        <>
          <Spinner aria-hidden="true" />
          ログアウト中...
        </>
      ) : (
        "ログアウト"
      )}
    </button>
  );
}
