import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import LoginButton from "@/app/(user)/_components/LoginButton";
import UserSidebarLayout from "@/app/(user)/_components/UserSidebarLayout";

export default async function UserLayout({
  children,
}: {
  children: ReactNode;
}) {
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

  const email = session.user?.email ?? null;
  const isAdmin = email ? await Admin(email) : false;

  return (
    <UserSidebarLayout
      isAdmin={isAdmin}
      userName={session.user?.name ?? null}
      userEmail={email}
    >
      {children}
    </UserSidebarLayout>
  );
}
