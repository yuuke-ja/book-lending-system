"use server";

import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordResearchEvent } from "@/lib/research-event.server";

type LoanBookResult =
  | { ok: true; status: 200; message: string }
  | {
      ok: false;
      status: 400 | 401 | 403 | 404 | 409 | 500;
      error: string;
    };

// 本番環境では日本時間どおりに曜日が取れないことがあるので、JSTで曜日を見る。
function getJstWeekday(date: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(date);

  switch (weekday) {
    case "Sun":
      return 0;
    case "Mon":
      return 1;
    case "Tue":
      return 2;
    case "Wed":
      return 3;
    case "Thu":
      return 4;
    case "Fri":
      return 5;
    case "Sat":
      return 6;
    default:
      return date.getUTCDay();
  }
}

function calcDueAtByReturnWeek(now: Date, returnWeek: number): Date {
  const safeWeekday =
    Number.isInteger(returnWeek) && returnWeek >= 1 && returnWeek <= 3
      ? returnWeek
      : 1;
  const due = new Date(now);
  const diff = (safeWeekday - getJstWeekday(now) + 7) % 7;
  due.setDate(due.getDate() + diff);

  // 日本時間の23:59:59にしたいので、UTCでは14:59:59を入れている。
  due.setUTCHours(14, 59, 59, 999);
  return due;
}

export async function loanBook(bookId: unknown): Promise<LoanBookResult> {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return { ok: false, status: 401, error: "認証が必要です" };
  }

  if (typeof bookId !== "string" || bookId === "") {
    return { ok: false, status: 400, error: "bookIdが不正です" };
  }

  try {
    const now = new Date();
    const settingsResult = await db.query(
      `SELECT id, "fridayOnly", "loanPeriodDays"
       FROM "LoanSettings"
       ORDER BY "createdAt" ASC
       LIMIT 1`,
    );
    const settings = settingsResult.rows[0] ?? null;

    let openPeriod = null;
    if (settings) {
      const openPeriodResult = await db.query(
        `SELECT id, "loanPeriodDays","endDate"
         FROM "LoanOpenPeriod"
         WHERE "loanSettingsId" = $1
           AND enabled = true
           AND "startDate" <= $2
           AND "endDate" >= $2
         LIMIT 1`,
        [settings.id, now],
      );
      openPeriod = openPeriodResult.rows[0] ?? null;
    }

    const fridayOnly = settings?.fridayOnly ?? true;
    const isFriday = getJstWeekday(now) === 5;
    const inOpenPeriod = Boolean(openPeriod);
    if (fridayOnly && !isFriday && !inOpenPeriod) {
      return {
        ok: false,
        status: 403,
        error: "貸出は金曜日のみ可能です",
      };
    }

    const bookResult = await db.query(
      `SELECT id FROM "Book" WHERE id = $1 LIMIT 1`,
      [bookId],
    );
    const book = bookResult.rows[0];
    if (!book) {
      return { ok: false, status: 404, error: "本が見つかりません" };
    }

    const alreadyLoanedResult = await db.query(
      `SELECT id
       FROM "Loan"
       WHERE "bookId" = $1
         AND "returnedAt" IS NULL
       LIMIT 1`,
      [bookId],
    );
    const alreadyLoaned = alreadyLoanedResult.rows[0];
    if (alreadyLoaned) {
      return {
        ok: false,
        status: 409,
        error: "この本はすでに貸出中です",
      };
    }

    const returnWeek = settings?.loanPeriodDays ?? 2;
    const exceptionDays = openPeriod?.endDate ?? null;
    const dueAt = exceptionDays ?? calcDueAtByReturnWeek(now, returnWeek);
    const loanId = randomUUID();

    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO "Loan" (id, "userEmail", "bookId", "dueAt")
         VALUES ($1, $2, $3, $4)`,
        [loanId, userEmail, bookId, dueAt],
      );
      await recordResearchEvent(
        {
          eventType: "loan",
          userEmail,
          bookId,
          sourceType: "direct",
          sourceId: null,
        },
        tx,
      );
    });

    return { ok: true, status: 200, message: "貸出が完了しました" };
  } catch (error) {
    console.error("貸出に失敗:", error);
    return { ok: false, status: 500, error: "貸出に失敗しました" };
  }
}
