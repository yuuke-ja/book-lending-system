import { notifications } from "@/lib/notification";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
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
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await notifications();
  return Response.json(
    { ok: true, message: "Daily notifications sent", ...result },
    { status: 200 }
  );
}
