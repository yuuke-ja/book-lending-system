import { notFound } from "next/navigation";
import { signIn } from "@/lib/auth";
import {
  e2eUsers,
  isE2ETestMode,
  isE2EUserEmail,
} from "@/lib/e2e-environment";

async function loginForE2E(formData: FormData) {
  "use server";

  if (!isE2ETestMode()) {
    throw new Error("E2E login is disabled");
  }

  const email = formData.get("email");
  if (typeof email !== "string" || !isE2EUserEmail(email)) {
    throw new Error("Unknown E2E user");
  }

  await signIn("e2e", { email, redirectTo: "/" });
}

export default function E2ELoginPage() {
  if (!isE2ETestMode()) {
    notFound();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 p-6">
      <section className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-widest text-zinc-500">
            LOCAL E2E ONLY
          </p>
          <h1 className="text-xl font-semibold text-zinc-900">
            E2Eテストログイン
          </h1>
        </div>

        {Object.entries(e2eUsers).map(([role, user]) => (
          <form key={role} action={loginForE2E}>
            <input type="hidden" name="email" value={user.email} />
            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-left text-sm font-semibold text-white hover:bg-zinc-700"
            >
              {user.name}でログイン
            </button>
          </form>
        ))}
      </section>
    </main>
  );
}
