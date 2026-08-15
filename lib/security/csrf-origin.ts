const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const ORIGIN_CHECK_EXEMPT_PATHS = new Set([
  "/api/admin/sync-admins",
  "/api/sync-admins",
]);

type CsrfEnvironment = {
  ALLOWED_ORIGINS?: string;
  NODE_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
};

export type OriginCheckResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "invalid-configuration"
        | "invalid-origin"
        | "missing-configuration"
        | "missing-origin"
        | "untrusted-origin";
    };

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function addConfiguredOrigin(
  origins: Set<string>,
  value: string | undefined
): boolean {
  if (!value) return true;

  const candidate = value.includes("://") ? value : `https://${value}`;
  const origin = normalizeOrigin(candidate.trim());

  if (!origin) {
    return false;
  }

  origins.add(origin);
  return true;
}

function getAllowedOrigins(
  requestUrl: URL,
  environment: CsrfEnvironment
): { isConfigurationValid: boolean; origins: Set<string> } {
  const origins = new Set<string>();
  let isConfigurationValid = true;

  for (const value of (environment.ALLOWED_ORIGINS ?? "").split(",")) {
    const configuredOrigin = value.trim();
    if (configuredOrigin) {
      isConfigurationValid =
        addConfiguredOrigin(origins, configuredOrigin) &&
        isConfigurationValid;
    }
  }

  isConfigurationValid =
    addConfiguredOrigin(origins, environment.VERCEL_URL) &&
    isConfigurationValid;
  isConfigurationValid =
    addConfiguredOrigin(origins, environment.VERCEL_PROJECT_PRODUCTION_URL) &&
    isConfigurationValid;

  const localHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (
    environment.NODE_ENV !== "production" &&
    localHostnames.has(requestUrl.hostname)
  ) {
    origins.add(requestUrl.origin);
  }

  return { isConfigurationValid, origins };
}

export function requiresOriginCheck(method: string, pathname: string): boolean {
  if (!MUTATING_METHODS.has(method.toUpperCase())) {
    return false;
  }

  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    return false;
  }

  return !ORIGIN_CHECK_EXEMPT_PATHS.has(pathname);
}

export function checkRequestOrigin(
  request: Pick<Request, "headers" | "url">,
  environment: CsrfEnvironment = process.env
): OriginCheckResult {
  const requestUrl = new URL(request.url);

  const rawOrigin = request.headers.get("origin");
  if (!rawOrigin || rawOrigin === "null") {
    return { ok: false, reason: "missing-origin" };
  }

  const origin = normalizeOrigin(rawOrigin);
  if (!origin) {
    return { ok: false, reason: "invalid-origin" };
  }

  const { isConfigurationValid, origins: allowedOrigins } = getAllowedOrigins(
    requestUrl,
    environment
  );

  if (!isConfigurationValid) {
    return { ok: false, reason: "invalid-configuration" };
  }

  if (allowedOrigins.size === 0) {
    return { ok: false, reason: "missing-configuration" };
  }

  if (!allowedOrigins.has(origin)) {
    return { ok: false, reason: "untrusted-origin" };
  }

  return { ok: true };
}
