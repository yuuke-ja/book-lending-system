import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import LoginButton from "@/app/(user)/_components/LoginButton";
import SignOutButton from "@/app/(user)/_components/SignOutButton";
import ReturnStatus from "@/app/(user)/_components/ReturnStatus";
import BorrowedBooksModal from "@/app/(user)/_components/BorrowedBooksModal";
import Link from "next/link";

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
      <ReturnStatus />
      <SignOutButton />

      {admin && (<Link href="/admin" className="mt-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800">
        管理者はこちら
      </Link>)}
      <Link href="/setting" className="mt-4 ml-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800">
        設定
      </Link>
      <Link href="/book-list" className="mt-4 ml-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800">
        本一覧
      </Link>
      <BorrowedBooksModal />
      <Link href="/loan/qr" className="mt-4 ml-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800">
        本を借りる
      </Link>

    </main>
  );
}
