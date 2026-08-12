import type { ReactNode } from "react";
import { Suspense } from "react";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import LoginButton from "@/app/(user)/_components/LoginButton";
import UserSidebarLayout from "@/app/(user)/_components/UserSidebarLayout";
import IdleSurveillance from "@/app/_components/IdleSurveillance";

export default function UserLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <UserGuard>{children}</UserGuard>
    </Suspense>
  );
}

async function UserGuard({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-50 p-6">
        <div className="space-y-4 text-center">
          <Image
            src="/icon/favicon.png"
            alt="Logo"
            width={64}
            height={64}
            sizes="64px"
            className="mx-auto h-16 w-16"
          />
          <h1 className="text-2xl font-semibold text-zinc-900">
            ログインが必要です
          </h1>
          <p className="text-sm text-zinc-600">
            学校のメールアドレスでログインしてください。
          </p>
          <LoginButton />
        </div>
      </main>
    );
  }

  const email = session.user?.email ?? null;
  const isAdmin = email ? await Admin(email) : false;

  return (
    <>
      <IdleSurveillance timeoutMinutes={isAdmin ? 30 : 60} />
      <UserSidebarLayout
        isAdmin={isAdmin}
        userName={session.user?.name ?? null}
        userEmail={email}
      >
        {children}
      </UserSidebarLayout>
    </>
  );
}
