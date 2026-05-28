import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// POST /api/user/salary-expectation — candidate states expected pay (post-submit, optional).
// Self-reported → stored with a timestamp so the recruiter breakdown renders it as SOFT context
// and can decay/flag stale values. Never a verified, statused line.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { amount, period } = await request.json();
    const n = parseInt(String(amount).replace(/[^0-9]/g, ''), 10);
    if (!n || n <= 0) return NextResponse.json({ error: 'Enter an amount' }, { status: 400 });
    const per = ['hr', 'mo', 'yr'].includes(period) ? period : 'mo';
    const value = `${n}/${per}`; // e.g. "1500/mo"
    await prisma.user.update({
      where: { id: session.user.id },
      data: { salaryExpectation: value, salaryExpectationAt: new Date() },
    });
    return NextResponse.json({ ok: true, value });
  } catch {
    return NextResponse.json({ error: 'bad input' }, { status: 400 });
  }
}
