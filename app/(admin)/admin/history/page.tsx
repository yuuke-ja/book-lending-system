import { redirect } from "next/navigation";
import { Admin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import {
  getLoanHistory,
  serializeLoanHistoryRow,
  type SerializedLoanHistoryRow,
} from "@/lib/loans/get-loan-history";
import AdminLoanHistoryClient from "./_components/AdminLoanHistoryClient";

export default async function AdminLoanHistoryPage() {
  const session = await auth();
  const email = session?.user?.email;
  const isAdmin = email ? await Admin(email) : false;

  if (!isAdmin) {
    redirect("/");
  }

  let rows: SerializedLoanHistoryRow[] = [];
  let error = "";

  try {
    const history = await getLoanHistory();
    rows = history.rows.map(serializeLoanHistoryRow);
  } catch (err) {
    console.error(err);
    error = "貸出履歴の取得に失敗しました";
  }

  return <AdminLoanHistoryClient rows={rows} error={error} />;
}
