import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  checkRequestOrigin,
  requiresOriginCheck,
} from "@/lib/security/csrf-origin";

export function proxy(request: NextRequest) {
  if (!requiresOriginCheck(request.method, request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const result = checkRequestOrigin(request);

  if (!result.ok) {
    const isConfigurationError =
      result.reason === "invalid-configuration" ||
      result.reason === "missing-configuration";

    return NextResponse.json(
      {
        error: isConfigurationError
          ? "CSRF保護の設定が不足しています"
          : "許可されていない送信元です",
      },
      {
        status: isConfigurationError ? 500 : 403,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
