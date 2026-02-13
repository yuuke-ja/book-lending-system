import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const email = session?.user?.email;
  const isAdmin = email ? await Admin(email) : false;

  if (!isAdmin) {
    redirect("/");
  }

  return <>{children}</>;
}
