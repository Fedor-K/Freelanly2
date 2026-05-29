import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Currency allowlist — covers the platform's main markets. Default USD.
// A bare number ("208000/mo") is meaningless to a recruiter without currency, so it's required context.
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'PKR', 'PHP', 'IDR', 'NGN', 'BDT', 'BRL', 'EGP', 'AED', 'CAD', 'AUD'];

// POST /api/user/salary-expectation — candidate states expected pay (post-submit, optional).
// Self-reported → stored with a timestamp so the recruiter breakdown renders it as SOFT context
// and can decay/flag stale values. Never a verified, statused line.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { amount, period, currency } = await request.json();
    const n = parseInt(String(amount).replace(/[^0-9]/g, ''), 10);
    // Reject empty/zero and absurd typos (e.g. an extra string of zeros) — keeps the recruiter view sane.
    if (!n || n <= 0) return NextResponse.json({ error: 'Enter an amount' }, { status: 400 });
    if (n > 100_000_000) return NextResponse.json({ error: 'Amount looks off — check it' }, { status: 400 });
    const per = ['hr', 'mo', 'yr'].includes(period) ? period : 'mo';
    const cur = CURRENCIES.includes(String(currency).toUpperCase()) ? String(currency).toUpperCase() : 'USD';
    const value = `${cur} ${n.toLocaleString('en-US')}/${per}`; // e.g. "USD 1,500/mo"
    await prisma.user.update({
      where: { id: session.user.id },
      data: { salaryExpectation: value, salaryExpectationAt: new Date() },
    });
    return NextResponse.json({ ok: true, value });
  } catch {
    return NextResponse.json({ error: 'bad input' }, { status: 400 });
  }
}
