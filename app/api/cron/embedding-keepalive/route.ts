import { NextResponse } from "next/server";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
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
  const embeddingApiUrl = process.env.EMBEDDING_API_URL?.replace(/\/$/, "");
  const hfToken = process.env.HF_TOKEN;
  if (!embeddingApiUrl || !hfToken) {
    return NextResponse.json(
      { error: "Embedding API の設定が不足しています" },
      { status: 500 }
    );
  }
  let response: Response;
  try {
    response = await fetch(`${embeddingApiUrl}/health`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${hfToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, message: `Keepalive リクエストがタイムアウト、または失敗しました: ${message}` },
      { status: 202 }
    );
  }

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      {
        error: "Embedding API の keepalive に失敗しました",
        status: response.status,
        message: message.slice(0, 300),
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
