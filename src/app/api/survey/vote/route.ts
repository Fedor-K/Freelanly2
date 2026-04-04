import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/survey/vote?email=...&token=...&choice=...
 * Records a survey vote and shows a thank-you page
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email')?.toLowerCase().trim();
  const choice = searchParams.get('choice');
  const token = searchParams.get('token');

  if (!email || !choice) {
    return new NextResponse('<h1>Invalid survey link</h1>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Simple token validation (HMAC of email)
  const crypto = await import('crypto');
  const secret = process.env.AUTH_SECRET || 'survey-secret';
  const expectedToken = crypto.createHmac('sha256', secret).update(`survey:${email}`).digest('hex').slice(0, 16);

  if (token !== expectedToken) {
    return new NextResponse('<h1>Invalid link</h1>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    // Find user
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    if (user) {
      // Log the vote in ActivityLog
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'SURVEY_VOTE',
          details: JSON.stringify({ survey: 'feature_request_apr2026', choice }),
          pageUrl: `/api/survey/vote?choice=${choice}`,
        },
      });
    }
  } catch (e) {
    console.error('[Survey] Error recording vote:', e);
  }

  const featureLabels: Record<string, string> = {
    'auto-apply': '🤖 Auto-apply to matching jobs',
    'ai-cover-letter': '📝 AI cover letter generator',
    'client-reviews': '💰 Client reviews & payment ratings',
    'direct-chat': '💬 Direct chat with clients',
    'salary-data': '📊 Salary data for your skill + country',
    'portfolio': '📄 Portfolio page on Freelanly',
    'payment-protection': '🛡️ Payment protection',
    'skill-tests': '🎓 Skill tests to stand out',
  };

  const choiceLabel = featureLabels[choice] || choice;

  // Build remaining feature buttons (exclude the one just voted)
  const remainingButtons = Object.entries(featureLabels)
    .filter(([id]) => id !== choice)
    .map(([id, label]) => {
      const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://freelanly.com'}/api/survey/vote?email=${encodeURIComponent(email)}&token=${token}&choice=${id}`;
      return `<a href="${url}" style="display:block; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; text-decoration:none; color:#1a1a1a; font-size:15px; margin:6px 0; text-align:left;">${label}</a>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thanks! — Freelanly</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 20px; }
  .card { max-width: 500px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  h1 { font-size: 28px; margin: 0 0 16px; }
  p { color: #666; font-size: 16px; line-height: 1.6; }
  .choice { background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 12px 20px; margin: 20px 0; font-size: 18px; }
  .more { text-align: left; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  .more h3 { font-size: 16px; color: #333; margin: 0 0 12px; text-align: center; }
  a.browse { color: #3b82f6; text-decoration: none; font-weight: 600; }
</style></head>
<body>
<div class="card">
  <h1>Thank you! 🙏</h1>
  <p>Your vote has been recorded:</p>
  <div class="choice">${choiceLabel}</div>

  <div class="more">
    <h3>Want to vote for more? Tap another:</h3>
    ${remainingButtons}
  </div>

  <p style="margin-top: 30px;"><a href="https://freelanly.com/freelance" class="browse">Browse latest projects →</a></p>
</div>
</body></html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
