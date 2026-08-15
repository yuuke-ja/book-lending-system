import "server-only";

import { Admin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import type { AdminActionResult } from "./result";

type AdminAuthResult =
  | { ok: true }
  | { ok: false; result: AdminActionResult };

export async function requireAdmin(): Promise<AdminAuthResult> {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return {
      ok: false,
      result: { ok: false, status: 401, error: "認証が必要です" },
    };
  }

  if (!(await Admin(email))) {
    return {
      ok: false,
      result: { ok: false, status: 403, error: "管理者権限が必要です" },
    };
  }

  return { ok: true };
}
