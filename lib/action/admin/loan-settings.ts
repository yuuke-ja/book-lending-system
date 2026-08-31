"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "./require-admin";
import type { AdminActionResult } from "./result";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LOAN_PERIOD_DAYS = 2;
const MIN_LOAN_PERIOD_DAYS = 1;
const MAX_LOAN_PERIOD_DAYS = 365;
const LOAN_SETTINGS_SINGLETON_KEY = "default";

type ParsedExceptionRule = {
  startDate: Date;
  endDate: Date;
  loanPeriodDays: number;
};

type LoanSettingsInput = {
  loanEnabled?: unknown;
  fridayOnly?: unknown;
  loanPeriodDays?: unknown;
  returnweek?: unknown;
  exceptionLoanPeriodDays?: unknown;
  exceptionRules?: unknown;
  exceptionStartDate?: unknown;
  exceptionEndDate?: unknown;
};

type ParsedLoanSettings = {
  loanEnabled: boolean;
  fridayOnly: boolean;
  returnweek: number;
  exceptionRules: ParsedExceptionRule[];
};

function parseDateStart(date: string): Date {
  return new Date(`${date}T00:00:00.000+09:00`);
}

function parseDateEnd(date: string): Date {
  return new Date(`${date}T23:59:59.999+09:00`);
}

function parseLoanDays(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < MIN_LOAN_PERIOD_DAYS || value > MAX_LOAN_PERIOD_DAYS) return null;
  return value;
}

function parseReturnWeek(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > 3) return null;
  return value;
}

function parseDateOnlyString(value: unknown): string | null {
  if (typeof value !== "string" || !DATE_ONLY_REGEX.test(value)) return null;
  return value;
}

function parseExceptionRule(rawRule: unknown): {
  rule: ParsedExceptionRule | null;
  error?: string;
} {
  if (typeof rawRule !== "object" || rawRule === null) {
    return { rule: null, error: "exceptionRulesが不正です" };
  }

  const rule = rawRule as Record<string, unknown>;
  const startDateText = parseDateOnlyString(rule.startDate);
  const endDateText = parseDateOnlyString(rule.endDate);
  if (!startDateText || !endDateText) {
    return { rule: null, error: "日付形式が不正です" };
  }

  const startDate = parseDateStart(startDateText);
  const endDate = parseDateEnd(endDateText);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { rule: null, error: "日付形式が不正です" };
  }
  if (startDate > endDate) {
    return { rule: null, error: "開始日は終了日以前にしてください" };
  }

  const loanPeriodDays = parseLoanDays(rule.loanPeriodDays);
  if (loanPeriodDays === null) {
    return { rule: null, error: "貸出日数が不正です" };
  }

  return { rule: { startDate, endDate, loanPeriodDays } };
}

function parseLoanSettings(value: unknown, now: Date): {
  parsed: ParsedLoanSettings | null;
  error?: string;
} {
  if (typeof value !== "object" || value === null) {
    return { parsed: null, error: "リクエスト形式が不正です" };
  }

  const body = value as LoanSettingsInput;
  if (typeof body.loanEnabled !== "boolean") {
    return { parsed: null, error: "loanEnabledが不正です" };
  }
  if (typeof body.fridayOnly !== "boolean") {
    return { parsed: null, error: "fridayOnlyが不正です" };
  }

  if (
    body.loanPeriodDays !== undefined &&
    parseLoanDays(body.loanPeriodDays) === null
  ) {
    return { parsed: null, error: "loanPeriodDaysが不正です" };
  }

  const returnweek = parseReturnWeek(body.returnweek);
  if (returnweek === null) {
    return { parsed: null, error: "returnweekが不正です" };
  }

  const exceptionRules: ParsedExceptionRule[] = [];
  if (Array.isArray(body.exceptionRules)) {
    for (const rawRule of body.exceptionRules) {
      const result = parseExceptionRule(rawRule);
      if (!result.rule) {
        return {
          parsed: null,
          error: result.error ?? "exceptionRulesが不正です",
        };
      }
      exceptionRules.push(result.rule);
    }
  } else {
    const hasStart =
      typeof body.exceptionStartDate === "string" &&
      body.exceptionStartDate.length > 0;
    const hasEnd =
      typeof body.exceptionEndDate === "string" &&
      body.exceptionEndDate.length > 0;

    if (hasStart !== hasEnd) {
      return { parsed: null, error: "開始日と終了日は両方入力してください" };
    }

    if (hasStart && hasEnd) {
      const startDateText = parseDateOnlyString(body.exceptionStartDate);
      const endDateText = parseDateOnlyString(body.exceptionEndDate);
      if (!startDateText || !endDateText) {
        return { parsed: null, error: "日付形式が不正です" };
      }

      const startDate = parseDateStart(startDateText);
      const endDate = parseDateEnd(endDateText);
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        return { parsed: null, error: "日付形式が不正です" };
      }
      if (startDate > endDate) {
        return { parsed: null, error: "開始日は終了日以前にしてください" };
      }
      if (endDate < now) {
        return { parsed: null, error: "終了日は過去の日付を指定できません" };
      }

      const loanPeriodDays = parseLoanDays(body.exceptionLoanPeriodDays);
      if (loanPeriodDays === null) {
        return {
          parsed: null,
          error: "exceptionLoanPeriodDaysが不正です",
        };
      }
      exceptionRules.push({ startDate, endDate, loanPeriodDays });
    }
  }

  return {
    parsed: {
      loanEnabled: body.loanEnabled,
      fridayOnly: body.fridayOnly,
      returnweek,
      exceptionRules,
    },
  };
}

async function getOrCreateLoanSettingsId(): Promise<string> {
  const result = await db.query(
    `INSERT INTO "LoanSettings" ("settingKey", id, "fridayOnly", "loanPeriodDays", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT ("settingKey")
     DO UPDATE SET "settingKey" = EXCLUDED."settingKey"
     RETURNING id`,
    [LOAN_SETTINGS_SINGLETON_KEY, randomUUID(), true, DEFAULT_LOAN_PERIOD_DAYS]
  );
  return result.rows[0].id;
}

export async function saveLoanSettings(
  input: unknown
): Promise<AdminActionResult> {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.result;

  try {
    const parseResult = parseLoanSettings(input, new Date());
    if (!parseResult.parsed) {
      return {
        ok: false,
        status: 400,
        error: parseResult.error ?? "入力が不正です",
      };
    }

    const { loanEnabled, fridayOnly, returnweek, exceptionRules } =
      parseResult.parsed;
    const settingsId = await getOrCreateLoanSettingsId();

    await db.transaction(async (tx) => {
      await tx.query(
        `UPDATE "LoanSettings"
         SET "loanEnabled" = $1,
             "fridayOnly" = $2,
             "loanPeriodDays" = $3,
             "updatedAt" = NOW()
         WHERE id = $4`,
        [loanEnabled, fridayOnly, returnweek, settingsId]
      );

      await tx.query(
        `UPDATE "LoanOpenPeriod"
         SET enabled = false,
             "updatedAt" = NOW()
         WHERE "loanSettingsId" = $1
           AND enabled = true`,
        [settingsId]
      );

      for (const rule of exceptionRules) {
        await tx.query(
          `INSERT INTO "LoanOpenPeriod"
            (id, "loanSettingsId", "startDate", "endDate", "loanPeriodDays", enabled, "updatedAt")
           VALUES ($1, $2, $3, $4, $5, true, NOW())`,
          [
            randomUUID(),
            settingsId,
            rule.startDate,
            rule.endDate,
            rule.loanPeriodDays,
          ]
        );
      }
    });

    revalidatePath("/admin");
    return { ok: true, status: 200, message: "保存しました" };
  } catch (error) {
    console.error("貸出設定の保存に失敗:", error);
    return {
      ok: false,
      status: 500,
      error: "貸出設定の保存に失敗しました",
    };
  }
}
