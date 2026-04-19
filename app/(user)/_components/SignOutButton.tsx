import { handleSignOut } from "@/lib/action/signout";

type SignOutButtonProps = {
  className?: string;
};

export default function SignOutButton({ className }: SignOutButtonProps) {
  return (
    <form action={handleSignOut}>
      <button type="submit" className={className}>
        ログアウト
      </button>
    </form>
  );
}
