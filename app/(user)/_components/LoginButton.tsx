import { signIn } from "@/lib/auth";
import LoginSubmitButton from "@/app/(user)/_components/LoginSubmitButton";

export default function LoginButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/" });
      }}
    >
      <LoginSubmitButton />
    </form>
  );
}
