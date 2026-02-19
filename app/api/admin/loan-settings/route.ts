import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LOAN_PERIOD_DAYS = 2;
const MIN_LOAN_PERIOD_DAYS = 1;
const MAX_LOAN_PERIOD_DAYS = 365;

type ParsedExceptionRule = {
  startDate: Date;
  endDate: Date;
  loanPeriodDays: number;
};

type RequireAdminResult =
  | { ok: true }
  | { ok: false; response: Response };

type PutBody = {
  fridayOnly?: unknown;
  loanPeriodDays?: unknown;
  exceptionLoanPeriodDays?: unknown;
  exceptionRules?: unknown;
  exceptionStartDate?: unknown;
  exceptionEndDate?: unknown;
};

type ParsedPutBody = {
  fridayOnly: boolean;
  loanPeriodDays: number;
  exceptionRules: ParsedExceptionRule[];
};

function parseDateStart(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function parseDateEnd(date: string): Date {
  return new Date(`${date}T23:59:59.999Z`);
}

function toDateOnly(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function errorJson(message: string, status: number): Response {
  return Response.json({ message }, { status });
}

function parseLoanDays(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isInteger(value)) return null;
  if (value < MIN_LOAN_PERIOD_DAYS || value > MAX_LOAN_PERIOD_DAYS) return null;
  return value;
}

function parseDateOnlyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!DATE_ONLY_REGEX.test(value)) return null;
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
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return { rule: null, error: "日付形式が不正です" };
  }
  if (startDate > endDate) {
    return { rule: null, error: "開始日は終了日以前にしてください" };
  }

  const loanPeriodDays = parseLoanDays(rule.loanPeriodDays);
  if (loanPeriodDays === null) {
    return { rule: null, error: "貸出日数が不正です" };
  }

  return {
    rule: {
      startDate,
      endDate,
      loanPeriodDays,
    },
  };
}

function parseExceptionRulesFromArray(value: unknown): {
  rules: ParsedExceptionRule[] | null;
  error?: string;
} {
  if (!Array.isArray(value)) return { rules: [] };

  const parsedRules: ParsedExceptionRule[] = [];
  for (const rawRule of value) {
    const result = parseExceptionRule(rawRule);
    if (!result.rule) {
      return { rules: null, error: result.error ?? "exceptionRulesが不正です" };
    }
    parsedRules.push(result.rule);
  }

  return { rules: parsedRules };
}

function parseLegacyExceptionRule(body: PutBody, now: Date): {
  rules: ParsedExceptionRule[] | null;
  error?: string;
} {
  const hasStart =
    typeof body.exceptionStartDate === "string" &&
    body.exceptionStartDate.length > 0;
  const hasEnd =
    typeof body.exceptionEndDate === "string" &&
    body.exceptionEndDate.length > 0;

  if (hasStart !== hasEnd) {
    return { rules: null, error: "開始日と終了日は両方入力してください" };
  }
  if (!hasStart && !hasEnd) {
    return { rules: [] };
  }

  const startDateText = parseDateOnlyString(body.exceptionStartDate);
  const endDateText = parseDateOnlyString(body.exceptionEndDate);
  if (!startDateText || !endDateText) {
    return { rules: null, error: "日付形式が不正です" };
  }

  const startDate = parseDateStart(startDateText);
  const endDate = parseDateEnd(endDateText);
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return { rules: null, error: "日付形式が不正です" };
  }
  if (startDate > endDate) {
    return { rules: null, error: "開始日は終了日以前にしてください" };
  }
  if (endDate < now) {
    return { rules: null, error: "終了日は過去の日付を指定できません" };
  }

  const exceptionLoanPeriodDays = parseLoanDays(body.exceptionLoanPeriodDays);
  if (exceptionLoanPeriodDays === null) {
    return { rules: null, error: "exceptionLoanPeriodDaysが不正です" };
  }

  return {
    rules: [
      {
        startDate,
        endDate,
        loanPeriodDays: exceptionLoanPeriodDays,
      },
    ],
  };
}

function parsePutBody(value: unknown, now: Date): {
  parsed: ParsedPutBody | null;
  error?: string;
} {
  if (typeof value !== "object" || value === null) {
    return { parsed: null, error: "リクエスト形式が不正です" };
  }
  const body = value as PutBody;

  if (typeof body.fridayOnly !== "boolean") {
    return { parsed: null, error: "fridayOnlyが不正です" };
  }

  const loanPeriodDays = parseLoanDays(body.loanPeriodDays);
  if (loanPeriodDays === null) {
    return { parsed: null, error: "loanPeriodDaysが不正です" };
  }

  let exceptionRules: ParsedExceptionRule[] = [];
  if (Array.isArray(body.exceptionRules)) {
    const parseResult = parseExceptionRulesFromArray(body.exceptionRules);
    if (parseResult.rules === null) {
      return {
        parsed: null,
        error: parseResult.error ?? "exceptionRulesが不正です",
      };
    }
    exceptionRules = parseResult.rules;
  } else {
    const legacyResult = parseLegacyExceptionRule(body, now);
    if (legacyResult.rules === null) {
      return { parsed: null, error: legacyResult.error ?? "入力が不正です" };
    }
    exceptionRules = legacyResult.rules;
  }

  return {
    parsed: {
      fridayOnly: body.fridayOnly,
      loanPeriodDays,
      exceptionRules,
    },
  };
}

async function requireAdmin(): Promise<RequireAdminResult> {
  const session = await auth();
  if (!session?.user?.email) {
    return {
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    };
  }

  const isAdmin = await Admin(session.user.email);
  if (!isAdmin) {
    return { ok: false, response: new Response("Forbidden", { status: 403 }) };
  }

  return { ok: true };
}

async function getOrCreateLoanSettingsId(): Promise<string> {
  const existing = await prisma.loanSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.loanSettings.create({
    data: {
      fridayOnly: true,
      loanPeriodDays: DEFAULT_LOAN_PERIOD_DAYS,
    },
    select: { id: true },
  });
  return created.id;
}

export async function GET() {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.response;

  try {
    const settings = await prisma.loanSettings.findFirst({
      orderBy: { createdAt: "asc" },
      include: {
        openPeriods: {
          where: { enabled: true },
          orderBy: { startDate: "asc" },
        },
      },
    });

    if (!settings) {
      return Response.json(
        {
          fridayOnly: true,
          loanPeriodDays: DEFAULT_LOAN_PERIOD_DAYS,
          exceptionStartDate: "",
          exceptionEndDate: "",
          exceptionLoanPeriodDays: DEFAULT_LOAN_PERIOD_DAYS,
          exceptionRules: [],
        },
        { status: 200 }
      );
    }

    const firstRule = settings.openPeriods[0] ?? null;
    const exceptionRules = settings.openPeriods.map((period) => ({
      startDate: toDateOnly(period.startDate),
      endDate: toDateOnly(period.endDate),
      loanPeriodDays: period.loanPeriodDays,
    }));

    return Response.json(
      {
        fridayOnly: settings.fridayOnly,
        loanPeriodDays: settings.loanPeriodDays,
        exceptionStartDate: toDateOnly(firstRule?.startDate ?? null),
        exceptionEndDate: toDateOnly(firstRule?.endDate ?? null),
        exceptionLoanPeriodDays:
          firstRule?.loanPeriodDays ?? DEFAULT_LOAN_PERIOD_DAYS,
        exceptionRules,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("貸出設定の取得に失敗:", error);
    return errorJson("貸出設定の取得に失敗しました", 500);
  }
}

export async function PUT(request: Request) {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.response;

  try {
    const body: unknown = await request.json();
    const parseResult = parsePutBody(body, new Date());
    if (!parseResult.parsed) {
      return errorJson(parseResult.error ?? "入力が不正です", 400);
    }

    const { fridayOnly, loanPeriodDays, exceptionRules } = parseResult.parsed;
    const settingsId = await getOrCreateLoanSettingsId();

    await prisma.$transaction(async (tx) => {
      await tx.loanSettings.update({
        where: { id: settingsId },
        data: { fridayOnly, loanPeriodDays },
      });

      await tx.loanOpenPeriod.updateMany({
        where: { loanSettingsId: settingsId, enabled: true },
        data: { enabled: false },
      });

      if (exceptionRules.length > 0) {
        await tx.loanOpenPeriod.createMany({
          data: exceptionRules.map((rule) => ({
            loanSettingsId: settingsId,
            startDate: rule.startDate,
            endDate: rule.endDate,
            loanPeriodDays: rule.loanPeriodDays,
            enabled: true,
          })),
        });
      }
    });

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("貸出設定の保存に失敗:", error);
    return errorJson("貸出設定の保存に失敗しました", 500);
  }
}
