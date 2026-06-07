import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getRecruiterPortalUrl, signRecruiterToken } from '@/lib/recruiter-token';

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

// Same visibility filter the portal itself applies (src/app/r/[token]/page.tsx), so the counts
// here match exactly what a recruiter would see — no surprise empty portals.
const MATCHER_FIX_CUTOFF = new Date('2026-05-26T00:00:00Z');

// Admin-only "view as recruiter".
//   • /api/admin/view-recruiter?email=<addr>  → mints a signed token and redirects into that portal.
//   • /api/admin/view-recruiter                → HTML index of recruiters that currently HAVE
//     candidates (ranked by count), each a one-click link into their populated portal.
// The token authorizes on its own (no OTP), so the owner sees exactly what the recruiter sees.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (email) {
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'pass a valid ?email=<recruiter email>' }, { status: 400 });
    }
    return NextResponse.redirect(getRecruiterPortalUrl(email));
  }

  // No email → list recruiters who have at least one visible candidate, most first.
  const grouped = await prisma.autoApplication.groupBy({
    by: ['appliedToEmail'],
    where: { sentAt: { not: null }, recruiterHidden: false, createdAt: { gte: MATCHER_FIX_CUTOFF } },
    _count: { appliedToEmail: true },
    orderBy: { _count: { appliedToEmail: 'desc' } },
    take: 100,
  });

  const rows = grouped
    .map((g) => ({ email: (g.appliedToEmail || '').toLowerCase(), count: g._count.appliedToEmail }))
    .filter((r) => r.email.includes('@'));

  const base = request.nextUrl.origin;
  const items = rows.map((r) => {
    const url = `${base}/r/${signRecruiterToken(r.email)}`;
    const esc = r.email.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<tr><td style="text-align:right;padding:6px 14px 6px 0;color:#6b7280;font-variant-numeric:tabular-nums">${r.count}</td>` +
      `<td style="padding:6px 0"><a href="${url}" style="color:#111;text-decoration:none;font-weight:600">${esc}</a></td></tr>`;
  }).join('');

  const html = `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Recruiters with candidates</title>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#111">
<h1 style="font-size:20px;margin:0 0 4px">Recruiters with candidates</h1>
<p style="color:#6b7280;font-size:13px;margin:0 0 20px">${rows.length} recruiter${rows.length === 1 ? '' : 's'} with at least one visible candidate (sent, not hidden, since ${MATCHER_FIX_CUTOFF.toISOString().slice(0, 10)}). Click to open their portal as the owner.</p>
<table style="border-collapse:collapse;font-size:14px;width:100%">${items || '<tr><td style="color:#6b7280;padding:8px 0">No recruiters have visible candidates right now.</td></tr>'}</table>
</body>`;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
