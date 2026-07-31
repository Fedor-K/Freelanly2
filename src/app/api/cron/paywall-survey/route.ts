import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/postal';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * TEMPORARY drip (owner 2026-07-31): asks FL FREE users who HIT THE APPLY PAYWALL and did NOT pay why
 * they didn't (re-keyed from top-up-clickers to all paywall-seen, since the PRO-first modal killed
 * top-up clicks). Sends <=70/day from info@freelanly.com, reply-to same. Idempotent — each
 * recipient is stamped with a `paywall_survey_sent` FUNNEL_STEP so re-runs / the daily cron never
 * double-send. Goes inert once the population is exhausted (sent 0, remaining 0). REMOVE this route +
 * its vercel.json cron once `remaining` hits 0 (~9 days).
 */
const SUBJECT = 'quick question — you almost applied';
const BATCH = 70;

function body(firstName: string) {
  const hi = firstName ? `Hi ${firstName},` : 'Hi there,';
  const text = `${hi}

I'm Theo from Freelanly. I noticed you found a role you wanted to apply to a little while back, but didn't finish the application — and I'm trying to understand why, so I can fix whatever got in the way.

Would you mind hitting reply and telling me, in one line, what stopped you? Too expensive, didn't trust it'd work, changed your mind, were just browsing — anything. Honest answer, there's no wrong one.

That's it. I read every reply myself.

Thank you,
Theo from Freelanly`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#222;line-height:1.6">`
    + text.split('\n\n').map(par => `<p>${par.replace(/\n/g, '<br>')}</p>`).join('')
    + `</div>`;
  return { text, html };
}

export async function GET(req: NextRequest) { return run(req); }   // Vercel cron sends GET
export async function POST(req: NextRequest) { return run(req); }  // manual trigger

async function run(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const candidates = await prisma.$queryRawUnsafe<Array<{ id: string; email: string; name: string | null }>>(`
    WITH intent AS (
      SELECT "userId", MAX("createdAt") last_seen FROM "ActivityLog" WHERE action='FUNNEL_STEP'
        AND details->>'step' = 'application_paywall_shown'
        AND "userId" IS NOT NULL AND "createdAt" >= now()-interval '45 days' GROUP BY "userId"),
    paid AS (
      SELECT DISTINCT "userId" FROM "ActivityLog" WHERE action='FUNNEL_STEP' AND details->>'step'='credit_charge_success' AND "userId" IS NOT NULL
      UNION
      SELECT DISTINCT "userId" FROM "RevenueEvent" WHERE type IN ('SUBSCRIPTION_STARTED','ONE_TIME_PAYMENT') AND "userId" IS NOT NULL),
    surveyed AS (SELECT DISTINCT "userId" FROM "ActivityLog" WHERE action='FUNNEL_STEP' AND details->>'step'='paywall_survey_sent')
    SELECT u.id, u.email, u.name
    FROM intent i JOIN "User" u ON u.id = i."userId"
    WHERE u.plan='FREE' AND u.email IS NOT NULL AND u.email <> ''
      AND i."userId" NOT IN (SELECT "userId" FROM paid)
      AND i."userId" NOT IN (SELECT "userId" FROM surveyed)
    ORDER BY i.last_seen DESC
    LIMIT ${BATCH}`);

  let sent = 0, failed = 0;
  for (const u of candidates) {
    const firstName = (u.name || '').trim().split(/\s+/)[0] || '';
    const { text, html } = body(firstName);
    const r = await sendEmail({
      to: u.email, subject: SUBJECT, html, text,
      from: 'info@freelanly.com', fromName: 'Theo from Freelanly', replyTo: 'info@freelanly.com',
    });
    if (r.success) {
      await prisma.activityLog.create({ data: { action: 'FUNNEL_STEP', userId: u.id, details: { step: 'paywall_survey_sent', channel: 'postal' } } }).catch(() => {});
      sent++;
    } else {
      failed++;
      // Abort on the first failure so a config/auth problem can't spew failures.
      if (sent === 0) break;
    }
    await new Promise((res) => setTimeout(res, 350));
  }

  const remainRows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(`
    WITH intent AS (
      SELECT "userId", MAX("createdAt") last_seen FROM "ActivityLog" WHERE action='FUNNEL_STEP'
        AND details->>'step' = 'application_paywall_shown'
        AND "userId" IS NOT NULL AND "createdAt" >= now()-interval '45 days' GROUP BY "userId"),
    paid AS (
      SELECT DISTINCT "userId" FROM "ActivityLog" WHERE action='FUNNEL_STEP' AND details->>'step'='credit_charge_success' AND "userId" IS NOT NULL
      UNION
      SELECT DISTINCT "userId" FROM "RevenueEvent" WHERE type IN ('SUBSCRIPTION_STARTED','ONE_TIME_PAYMENT') AND "userId" IS NOT NULL),
    surveyed AS (SELECT DISTINCT "userId" FROM "ActivityLog" WHERE action='FUNNEL_STEP' AND details->>'step'='paywall_survey_sent')
    SELECT COUNT(*)::int n FROM intent i JOIN "User" u ON u.id=i."userId"
    WHERE u.plan='FREE' AND u.email IS NOT NULL AND u.email <> ''
      AND i."userId" NOT IN (SELECT "userId" FROM paid) AND i."userId" NOT IN (SELECT "userId" FROM surveyed)`);
  const remaining = remainRows[0]?.n ?? 0;

  return NextResponse.json({ sent, failed, remaining });
}
