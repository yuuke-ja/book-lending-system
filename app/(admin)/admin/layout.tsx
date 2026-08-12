import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import IdleSurveillance from "@/app/_components/IdleSurveillance";
import { AdminBackLink } from "./_components/AdminBackLink";

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <AdminGuard>
        <AdminBackLink />
        {children}
      </AdminGuard>
    </Suspense>
  );
}

async function AdminGuard({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email;
  const isAdmin = email ? await Admin(email) : false;

  if (!isAdmin) {
    redirect("/");
  }

  return (
    <>
      <IdleSurveillance timeoutMinutes={30} />
      {children}
    </>
  );
}
