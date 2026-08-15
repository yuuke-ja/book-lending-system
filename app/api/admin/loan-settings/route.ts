import { connection, NextResponse } from "next/server";
import { Admin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const DEFAULT_LOAN_PERIOD_DAYS = 2;

function toDateOnly(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

export async function GET() {
  await connection();
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await Admin(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const settingsResult = await db.query(
      `SELECT id, "fridayOnly", "loanPeriodDays"
       FROM "LoanSettings"
       ORDER BY "createdAt" ASC
       LIMIT 1`
    );
    const settings = settingsResult.rows[0] ?? null;

    if (!settings) {
      return NextResponse.json({
        fridayOnly: true,
        loanPeriodDays: DEFAULT_LOAN_PERIOD_DAYS,
        exceptionStartDate: "",
        exceptionEndDate: "",
        exceptionLoanPeriodDays: DEFAULT_LOAN_PERIOD_DAYS,
        exceptionRules: [],
      });
    }

    const openPeriodsResult = await db.query(
      `SELECT "startDate", "endDate", "loanPeriodDays"
       FROM "LoanOpenPeriod"
       WHERE "loanSettingsId" = $1
         AND enabled = true
       ORDER BY "startDate" ASC`,
      [settings.id]
    );
    const openPeriods = openPeriodsResult.rows;
    const firstRule = openPeriods[0] ?? null;

    return NextResponse.json({
      fridayOnly: settings.fridayOnly,
      loanPeriodDays: settings.loanPeriodDays,
      exceptionStartDate: toDateOnly(firstRule?.startDate ?? null),
      exceptionEndDate: toDateOnly(firstRule?.endDate ?? null),
      exceptionLoanPeriodDays:
        firstRule?.loanPeriodDays ?? DEFAULT_LOAN_PERIOD_DAYS,
      exceptionRules: openPeriods.map((period) => ({
        startDate: toDateOnly(period.startDate),
        endDate: toDateOnly(period.endDate),
        loanPeriodDays: period.loanPeriodDays,
      })),
    });
  } catch (error) {
    console.error("貸出設定の取得に失敗:", error);
    return NextResponse.json(
      { message: "貸出設定の取得に失敗しました" },
      { status: 500 }
    );
  }
}
