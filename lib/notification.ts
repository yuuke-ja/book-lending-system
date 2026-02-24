import { db } from "@/lib/db";
import webpush from "web-push";

type NotificationResult = {
  targetedUsers: number;
  subscriptions: number;
  sent: number;
  failed: number;
  removed: number;
};

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
//同時に送る通知の数20件まで。
const CONCURRENCY = 20;

type DueCountRow = {
  userEmail: string;
  dueCount: number;
};

type PushSubscriptionRow = {
  id: string;
  userEmail: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function getJstTodayRange() {
  const now = new Date();
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const start = new Date(
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) -
    JST_OFFSET_MS
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

function toStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const maybeCode = (error as { statusCode?: unknown }).statusCode;
  return typeof maybeCode === "number" ? maybeCode : null;
}

export async function notifications(): Promise<NotificationResult> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are not set");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com",
    publicKey,
    privateKey
  );

  const { start, end } = getJstTodayRange();

  const groupedResult = await db.query<DueCountRow>(
    `SELECT "userEmail", COUNT(*)::int AS "dueCount"
     FROM "Loan"
     WHERE "returnedAt" IS NULL
       AND "dueAt" >= $1
       AND "dueAt" <= $2
     GROUP BY "userEmail"`,
    [start, end]
  );
  const grouped = groupedResult.rows;

  if (grouped.length === 0) {
    return { targetedUsers: 0, subscriptions: 0, sent: 0, failed: 0, removed: 0 };
  }

  const dueCountByEmail = new Map<string, number>(
    grouped.map((g) => [g.userEmail, g.dueCount])
  );
  const targetEmails = grouped.map((g) => g.userEmail);

  const subscriptionsResult = await db.query<PushSubscriptionRow>(
    `SELECT id, "userEmail", endpoint, p256dh, auth
     FROM "PushSubscription"
     WHERE "userEmail" = ANY($1)`,
    [targetEmails]
  );
  const subscriptions = subscriptionsResult.rows;

  let sent = 0;
  let failed = 0;
  const invalidIds: string[] = [];
  // 20件ずつ並列で通知を送る。 
  for (let i = 0; i < subscriptions.length; i += CONCURRENCY) {
    const batch = subscriptions.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (sub) => {
        const count = dueCountByEmail.get(sub.userEmail) ?? 0;
        if (count <= 0) return;
        const payload = JSON.stringify({
          title: "返却期限のお知らせ",
          body: `今日返す本が${count}件あります。`,
          url: "/return",
        });
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
      })
    );

    results.forEach((result: PromiseSettledResult<void>, index: number) => {
      if (result.status === "fulfilled") {
        sent += 1;
        return;
      }
      failed += 1;
      const code = toStatusCode(result.reason);
      if (code === 404 || code === 410) {
        invalidIds.push(batch[index].id);
      }
    });
  }

  if (invalidIds.length > 0) {
    await db.query(
      `DELETE FROM "PushSubscription" WHERE id = ANY($1)`,
      [invalidIds]
    );
  }

  return {
    targetedUsers: grouped.length,
    subscriptions: subscriptions.length,
    sent,
    failed,
    removed: invalidIds.length,
  };
}
