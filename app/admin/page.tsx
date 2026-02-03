import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
export default async function AdminPage() {
  const session = await auth();
  if (!session) {
    redirect("/");
  }
  const email = session.user?.email;
  const admin = email ? await Admin(email) : false;
  if (!admin) {
    redirect("/");
  }
  return (
    <main className="min-h-screen bg-white p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">管理者ページ</h1>
      <Link href="/" className="mt-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800">
        トップページに戻る
      </Link>
      <Link href="/admin/registration" className="mt-4 ml-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800">
        本登録
      </Link>

    </main>
  );
}
