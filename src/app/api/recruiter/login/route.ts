import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRecruiterPortalUrl } from '@/lib/recruiter-token';
import { sendEmail } from '@/lib/email';

// POST /api/recruiter/login — recruiter enters their email; we email them their portal link.
// The link is a signed (HMAC) token of the email (recruiter-token.ts), so this is a passwordless
// magic-link: only the inbox owner receives it. Makes the /r portal a re-enterable account
// without a password — completes the registration flow (which created accounts that couldn't
// log back in). We only send to emails that ACTUALLY received applications (or registered),
// so this can't be used to email-bomb arbitrary strangers. Rate-limited per email in the DB
// (in-memory limiters don't work on serverless). Response is always generic — never reveals
// whether an email is a known recruiter.
const MAX_PER_HOUR = 3;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
    if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 });
    }

    // Only real recruiters (received an application) or already-registered ones get a link.
    const known =
      (await prisma.autoApplication.findFirst({ where: { appliedToEmail: { equals: email, mode: 'insensitive' } }, select: { id: true } })) ||
      (await prisma.recruiter.findUnique({ where: { email }, select: { id: true } }));

    if (known) {
      // DB-based per-email rate limit (serverless-safe).
      const recent = await prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM "ActivityLog"
        WHERE action = 'RECRUITER_PORTAL_ACTION'
          AND details->>'event' = 'login_link_sent'
          AND details->>'recruiterEmail' = ${email}
          AND "createdAt" > now() - interval '1 hour'`;
      const sentRecently = Number(recent[0]?.n || 0);

      if (sentRecently < MAX_PER_HOUR) {
        const url = getRecruiterPortalUrl(email);
        await sendEmail({
          to: email,
          subject: 'Your candidate inbox on Freelanly',
          html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0B0C0F">
  <h2 style="font-size:18px;margin:0 0 8px">Your candidates on Freelanly</h2>
  <p style="font-size:14px;color:#555;line-height:1.55;margin:0 0 20px">Open your inbox to see who applied to your roles, view CVs and reply.</p>
  <a href="${url}" style="display:inline-block;background:#0B0C0F;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Open my candidates &rarr;</a>
  <p style="font-size:12.5px;color:#8A8780;margin:22px 0 0">Tip: bookmark that link — it's your permanent inbox, no password needed.</p>
</div>`,
          text: `Open your candidates on Freelanly: ${url}\n\nTip: bookmark that link — it's your permanent inbox, no password needed.`,
        });
        const h = request.headers;
        await prisma.activityLog.create({
          data: {
            action: 'RECRUITER_PORTAL_ACTION',
            details: { recruiterEmail: email, event: 'login_link_sent' },
            ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            userAgent: h.get('user-agent') || null,
          },
        }).catch(() => {});
      }
    }

    // Always generic — don't reveal whether the email is a known recruiter.
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // UI shows the same "check your email" regardless
  }
}
