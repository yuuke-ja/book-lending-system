"use server";

import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type PushActionResult =
  | { ok: true; status: 200; message: string }
  | { ok: false; status: 400 | 401 | 500; error: string };

type SubscriptionInput = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

export async function subscribePushNotification(
  input: unknown
): Promise<PushActionResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return { ok: false, status: 401, error: "認証が必要です" };
  }

  const subscription: SubscriptionInput =
    typeof input === "object" && input !== null ? input : {};
  const endpoint =
    typeof subscription.endpoint === "string" ? subscription.endpoint : "";
  const p256dh =
    typeof subscription.keys?.p256dh === "string"
      ? subscription.keys.p256dh
      : "";
  const authKey =
    typeof subscription.keys?.auth === "string" ? subscription.keys.auth : "";

  if (!endpoint || !p256dh || !authKey) {
    return { ok: false, status: 400, error: "購読情報が不正です" };
  }

  try {
    await db.query(
      `INSERT INTO "PushSubscription" (id, "userEmail", endpoint, p256dh, auth, "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (endpoint)
       DO UPDATE SET
         "userEmail" = EXCLUDED."userEmail",
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         "updatedAt" = NOW()`,
      [randomUUID(), email, endpoint, p256dh, authKey]
    );

    return { ok: true, status: 200, message: "通知を登録しました" };
  } catch (error) {
    console.error("Push通知の登録に失敗:", error);
    return { ok: false, status: 500, error: "通知登録に失敗しました" };
  }
}

export async function unsubscribePushNotification(
  endpoint: unknown
): Promise<PushActionResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return { ok: false, status: 401, error: "認証が必要です" };
  }
  if (typeof endpoint !== "string" || endpoint.trim() === "") {
    return { ok: false, status: 400, error: "endpointが不正です" };
  }

  try {
    await db.query(
      `DELETE FROM "PushSubscription" WHERE "userEmail" = $1 AND endpoint = $2`,
      [email, endpoint]
    );
    return { ok: true, status: 200, message: "通知を解除しました" };
  } catch (error) {
    console.error("Push通知の解除に失敗:", error);
    return { ok: false, status: 500, error: "通知解除に失敗しました" };
  }
}
