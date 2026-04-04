import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendApplicationEmail } from '@/lib/email';
import { isCronAuthorized } from '@/lib/cron-auth';
import crypto from 'crypto';

const SURVEY_ID = 'feature_request_apr2026';
const BATCH_SIZE = 50;
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
      try {
        const data = JSON.parse(v.details || '{}');
        if (data.survey === SURVEY_ID && data.choice) {
          counts[data.choice] = (counts[data.choice] || 0) + 1;
        }
      } catch {}
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
    // Find engaged FREE users: received 10+ emails, not unsubscribed, haven't been surveyed
    const alreadySurveyed = await prisma.activityLog.findMany({
      where: { action: 'SURVEY_SENT', details: { contains: SURVEY_ID } },
      select: { userId: true },
    });
    const surveyedIds = new Set(alreadySurveyed.map(a => a.userId));

    // Get engaged free users
    const candidates = await prisma.user.findMany({
      where: {
        plan: 'FREE',
        unsubscribedFromMarketing: { not: true },
        email: { not: { contains: '@test' } },
      },
      select: { id: true, email: true, name: true },
    });

    // Filter: not already surveyed, and has 10+ emails received
    const eligible = [];
    for (const user of candidates) {
      if (surveyedIds.has(user.id)) continue;

      const emailCount = await prisma.activityLog.count({
        where: { userId: user.id, action: 'EMAIL_SENT' },
      });
      if (emailCount >= 10) {
        eligible.push(user);
      }
      if (eligible.length >= BATCH_SIZE) break;
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
      totalCandidates: candidates.length,
      alreadySurveyed: surveyedIds.size,
    });
  } catch (error) {
    console.error('[Survey] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
