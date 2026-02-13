import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { ok: false as const, response: new Response("Unauthorized", { status: 401 }) };
  }

  const isAdmin = await Admin(session.user.email);
  if (!isAdmin) {
    return { ok: false as const, response: new Response("Forbidden", { status: 403 }) };
  }

  return { ok: true as const };
}

export async function GET() {
  const authResult = await requireAdmin();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    // 既存の貸出設定と例外期間
    const settings = await prisma.loanSettings.findFirst({
      orderBy: { createdAt: "asc" },
      include: {
        openPeriods: {
          where: { enabled: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!settings) {
      return Response.json(
        {
          fridayOnly: true,
          exceptionStartDate: "",
          exceptionEndDate: "",
          loanPeriodDays: 2,
        },
        { status: 200 }
      );
    }

    const activePeriod = settings.openPeriods[0] ?? null;
    return Response.json(
      {
        fridayOnly: settings.fridayOnly,
        exceptionStartDate: toDateOnly(activePeriod?.startDate ?? null),
        exceptionEndDate: toDateOnly(activePeriod?.endDate ?? null),
        loanPeriodDays: settings.loanPeriodDays,
      },
      { status: 200 }
    );
  } catch {
    return new Response("貸出設定の取得に失敗しました", { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authResult = await requireAdmin();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const body = await request.json();
    const fridayOnly = body?.fridayOnly;
    const loanPeriodDays = body?.loanPeriodDays;
    const exceptionStartDate = body?.exceptionStartDate;
    const exceptionEndDate = body?.exceptionEndDate;

    if (typeof fridayOnly !== "boolean") {
      return new Response("fridayOnlyが不正です", { status: 400 });
    }
    if (
      !Number.isInteger(loanPeriodDays) ||
      loanPeriodDays < 1 ||
      loanPeriodDays > 365
    ) {
      return new Response("loanPeriodDaysが不正です", { status: 400 });
    }

    const hasStart = typeof exceptionStartDate === "string" && exceptionStartDate.length > 0;
    const hasEnd = typeof exceptionEndDate === "string" && exceptionEndDate.length > 0;
    if (hasStart !== hasEnd) {
      return new Response("開始日と終了日は両方入力してください", { status: 400 });
    }

    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (hasStart && hasEnd) {
      if (
        !DATE_ONLY_REGEX.test(exceptionStartDate) ||
        !DATE_ONLY_REGEX.test(exceptionEndDate)
      ) {
        return new Response("日付形式が不正です", { status: 400 });
      }
      startDate = parseDateStart(exceptionStartDate);
      endDate = parseDateEnd(exceptionEndDate);
      if (startDate > endDate) {
        return new Response("開始日は終了日以前にしてください", { status: 400 });
      }
    }

    // このシステムで使う貸出設定レコードのidを1件取得する。
    const existing = await prisma.loanSettings.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    // 初期値で作成する。
    const settings = existing ??
      (await prisma.loanSettings.create({
        data: {
          fridayOnly: true,
          loanPeriodDays: 2,
        },
        select: { id: true },
      }));

    // 金曜のon/offを更新する。
    await prisma.loanSettings.update({
      where: { id: settings.id },
      data: { fridayOnly, loanPeriodDays },
    });

    // 例外期間をいったん無効化する。
    await prisma.loanOpenPeriod.updateMany({
      where: { loanSettingsId: settings.id, enabled: true },
      data: { enabled: false },
    });

    // 例外期間を作る。
    if (startDate && endDate) {
      await prisma.loanOpenPeriod.create({
        data: {
          loanSettingsId: settings.id,
          startDate,
          endDate,
          enabled: true,
        },
      });
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch {
    return new Response("貸出設定の保存に失敗しました", { status: 500 });
  }
}
