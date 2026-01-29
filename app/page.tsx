import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import LoginButton from "./_components/LoginButton";
import SignOutButton from "./_components/SignOutButton";


export default async function Home() {
  const session = await auth();
  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-50 p-6">
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">
            ログインしてください
          </h1>
          <LoginButton />
        </div>
      </main>
    );
  }
  const email = session.user?.email;
  const admin = email ? await Admin(email) : false;

  return (
    <main className="min-h-screen bg-white p-6">
      <SignOutButton />
      <h1 className="text-2xl font-semibold text-zinc-900">
        ようこそ{session.user?.name ? `、${session.user.name}` : ""}
      </h1>
      {admin && (<p>あなたは管理者です</p>)}

    </main>
  );
}
