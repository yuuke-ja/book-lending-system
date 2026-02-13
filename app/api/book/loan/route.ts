import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  const userEmail = session.user?.email;
  if (!userEmail) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const body = await request.json();
    const { bookId } = body;
    if (!bookId || typeof bookId !== 'string') {
      return new Response('bookIdが不正です', { status: 400 });
    }
    const now = new Date();
    const settings = await prisma.loanSettings.findFirst({
      orderBy: { createdAt: 'asc' },
      select: {
        fridayOnly: true,
        openPeriods: {
          where: {
            enabled: true,
            startDate: { lte: now },
            endDate: { gte: now },
          },
          select: { id: true },
          take: 1,
        },
      },
    });
    const fridayOnly = settings?.fridayOnly ?? true;
    const isFriday = now.getDay() === 5;
    const inOpenPeriod = (settings?.openPeriods.length ?? 0) > 0;
    if (fridayOnly && !isFriday && !inOpenPeriod) {
      return new Response('貸出は金曜日のみ可能です', { status: 403 });
    }
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true },
    });
    if (!book) {
      return new Response('本が見つかりません', { status: 404 });
    }
    const alreadyLoaned = await prisma.loan.findFirst({
      where: { bookId, returnedAt: null },
      select: { id: true },
    });
    if (alreadyLoaned) {
      return new Response('すでに貸出中です', { status: 409 });
    }
    await prisma.loan.create({
      data: {
        userEmail,
        bookId,
      },
    });
    return new Response('貸出が完了しました', { status: 200 });
  } catch (error) {
    return new Response('貸出に失敗しました', {
      status: 500,
    });
  }
}
export async function GET() {
  const session = await auth();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  const userEmail = session.user?.email;
  if (!userEmail) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const loans = await prisma.loan.findMany({
      where: { returnedAt: null, userEmail },
      include: {
        book: true,
      },
      orderBy: { loanedAt: 'desc' },
    });
    return new Response(
      JSON.stringify(
        loans.map((loan) => ({
          id: loan.id,
          bookId: loan.bookId,
          loanedAt: loan.loanedAt,
          book: loan.book,
        }))
      ),
      { status: 200 }
    );
  } catch (error) {
    return new Response('貸出状況の取得に失敗しました', {
      status: 500,
    });
  }
}
