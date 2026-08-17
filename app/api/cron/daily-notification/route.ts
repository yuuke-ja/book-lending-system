import { notifications } from "@/lib/notification";
import { NextResponse } from "next/server";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  //不正アクセス防止のため、クエリパラメータやヘッダーに秘密の値が含まれているかをチェックする。
  const xSecret = request.headers.get("x-cron-secret");
  if (xSecret && xSecret === secret) return true;

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  if (!authHeader.startsWith("Bearer ")) return false;
  return authHeader.slice("Bearer ".length) === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  try {
    const result = await notifications();
    return NextResponse.json(
      { ok: true, message: "Daily notifications sent", ...result },
      { status: 200 }
    );
  } catch (error) {
    console.error("日次通知の送信に失敗:", error);
    return NextResponse.json(
      { ok: false, error: "日次通知の送信に失敗しました" },
      { status: 500 }
    );
  }
}
