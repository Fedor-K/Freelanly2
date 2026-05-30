import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendApplicationEmail } from '@/lib/email';
import { isCronAuthorized } from '@/lib/cron-auth';
import crypto from 'crypto';

const SURVEY_ID = 'feature_request_apr2026';
const BATCH_SIZE = 100;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://freelanly.com';

function surveyToken(email: string): string {
  const secret = process.env.AUTH_SECRET || 'survey-secret';
  return crypto.createHmac('sha256', secret).update(`survey:${email}`).digest('hex').slice(0, 16);
}

function voteUrl(email: string, choice: string): string {
  const token = surveyToken(email);
  return `${APP_URL}/api/survey/vote?email=${encodeURIComponent(email)}&token=${token}&choice=${choice}`;
}

function generateSurveyHtml(email: string, name: string | null): string {
  const greeting = name ? `Hi ${name.split(' ')[0]}` : 'Hi there';

  const features = [
    { id: 'auto-apply', emoji: '🤖', label: 'Auto-apply to matching jobs' },
    { id: 'ai-cover-letter', emoji: '📝', label: 'AI cover letter for each job' },
    { id: 'client-reviews', emoji: '💰', label: 'Client reviews & payment ratings' },
    { id: 'direct-chat', emoji: '💬', label: 'Direct chat with clients' },
    { id: 'salary-data', emoji: '📊', label: 'Salary data for my skill + country' },
    { id: 'portfolio', emoji: '📄', label: 'Portfolio page on Freelanly' },
    { id: 'payment-protection', emoji: '🛡️', label: 'Payment protection for freelancers' },
    { id: 'skill-tests', emoji: '🎓', label: 'Skill tests to stand out' },
  ];

  const buttons = features.map(f => `
    <tr><td style="padding: 4px 0;">
      <a href="${voteUrl(email, f.id)}" style="display:block; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px 20px; text-decoration:none; color:#1a1a1a; font-size:15px;">
        ${f.emoji}&nbsp;&nbsp;${f.label}
      </a>
    </td></tr>
  `).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f5f5f5;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5f5;">
<tr><td align="center" style="padding:40px 20px;">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; background:#fff; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">

  <!-- Header -->
  <tr><td style="background:#000; padding:30px; text-align:center; border-radius:12px 12px 0 0;">
    <h1 style="margin:0; color:#fff; font-size:22px;">Quick question (10 seconds)</h1>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:30px;">
    <p style="font-size:16px; color:#333; line-height:1.6; margin:0 0 10px;">
      ${greeting},
    </p>
    <p style="font-size:16px; color:#333; line-height:1.6; margin:0 0 20px;">
      You've been browsing jobs on Freelanly — we want to build what <strong>you</strong> actually need.
    </p>
    <p style="font-size:16px; color:#333; line-height:1.6; margin:0 0 20px;">
      <strong>What feature would help you land more freelance work?</strong> Just tap one:
    </p>

    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      ${buttons}
    </table>

    <p style="font-size:14px; color:#999; margin:20px 0 0; line-height:1.5;">
      One tap = done. Your answer directly shapes what we build next.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 30px; background:#f9f9f9; border-radius:0 0 12px 12px; text-align:center;">
    <p style="margin:0; font-size:12px; color:#999;">
      Freelanly.com — Remote jobs for freelancers
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

/**
 * POST /api/cron/send-survey — send survey emails to engaged FREE users
 * GET  /api/cron/send-survey?action=results — get survey results
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get('action') === 'results') {
    // Get survey results
    const votes = await prisma.activityLog.findMany({
      where: { action: 'SURVEY_VOTE' },
      select: { details: true },
    });

    const counts: Record<string, number> = {};
    for (const v of votes) {
      // details is a Prisma Json column — already an object, not a string to parse.
      const data = (v.details && typeof v.details === 'object' ? v.details : {}) as { survey?: string; choice?: string };
      if (data.survey === SURVEY_ID && data.choice) {
        counts[data.choice] = (counts[data.choice] || 0) + 1;
      }
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return NextResponse.json({ survey: SURVEY_ID, totalVotes: sorted.reduce((s, [, c]) => s + c, 0), results: sorted });
  }

  return NextResponse.json({ error: 'Use POST to send, GET?action=results for results' });
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'clickers'; // 'clickers' or 'pro'

    const alreadySurveyed = await prisma.activityLog.findMany({
      where: { action: 'SURVEY_SENT', details: { string_contains: SURVEY_ID } },
      select: { userId: true },
    });
    const surveyedIds = new Set(alreadySurveyed.map(a => a.userId));

    let eligible: { id: string; email: string; name: string | null }[];

    if (mode === 'engaged') {
      // Send to FREE users with 5+ emails received (broader audience)
      type EngagedRow = { userId: string; email: string; name: string | null };
      const engaged = await prisma.$queryRaw<EngagedRow[]>`
        SELECT u.id as "userId", u.email, u.name
        FROM "User" u
        WHERE u.plan = 'FREE'
          AND u."unsubscribedFromMarketing" IS NOT TRUE
          AND u.id IN (
            SELECT "userId" FROM "ActivityLog"
            WHERE action = 'EMAIL_SENT'
            GROUP BY "userId"
            HAVING COUNT(*) >= 5
          )
        ORDER BY u."createdAt" DESC
      `;
      eligible = engaged
        .filter(u => !surveyedIds.has(u.userId))
        .slice(0, BATCH_SIZE)
        .map(u => ({ id: u.userId, email: u.email, name: u.name }));
    } else if (mode === 'pro') {
      // Send to all PRO users
      type ProRow = { id: string; email: string; name: string | null };
      const proUsers = await prisma.$queryRaw<ProRow[]>`
        SELECT id, email, name FROM "User"
        WHERE plan = 'PRO' AND "unsubscribedFromMarketing" IS NOT TRUE
      `;
      eligible = proUsers
        .filter(u => !surveyedIds.has(u.id))
        .slice(0, BATCH_SIZE);
    } else {
      // Default: send to email clickers (FREE users)
      type ClickerRow = { userId: string; email: string; name: string | null; clicks: number };
      const clickers = await prisma.$queryRaw<ClickerRow[]>`
        SELECT ja."userId", u.email, u.name, CAST(COUNT(*) AS INTEGER) as clicks
        FROM "ActivityLog" a
        JOIN "JobAlert" ja ON ja.id = (a.details::json->>'alertId')
        JOIN "User" u ON u.id = ja."userId"
        WHERE a.action = 'ALERT_EMAIL_CLICK'
          AND u.plan = 'FREE'
          AND u."unsubscribedFromMarketing" IS NOT TRUE
        GROUP BY ja."userId", u.email, u.name
        ORDER BY clicks DESC
      `;
      eligible = clickers
        .filter(c => !surveyedIds.has(c.userId))
        .slice(0, BATCH_SIZE)
        .map(c => ({ id: c.userId, email: c.email, name: c.name }));
    }

    let sent = 0;
    let errors = 0;

    for (const user of eligible) {
      try {
        const html = generateSurveyHtml(user.email, user.name);

        const result = await sendApplicationEmail({
          to: user.email,
          subject: '🎯 Quick question — what feature do you need most?',
          html,
          emailType: 'other',
        });

        if (result.success) {
          // Mark as surveyed
          await prisma.activityLog.create({
            data: {
              userId: user.id,
              action: 'SURVEY_SENT',
              details: JSON.stringify({ survey: SURVEY_ID }),
            },
          });
          sent++;
        } else {
          errors++;
        }
      } catch (e) {
        errors++;
        console.error(`[Survey] Error sending to ${user.email}:`, e);
      }
    }

    return NextResponse.json({
      ok: true,
      eligible: eligible.length,
      sent,
      errors,
      totalCandidates: eligible.length,
      alreadySurveyed: surveyedIds.size,
    });
  } catch (error) {
    console.error('[Survey] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
