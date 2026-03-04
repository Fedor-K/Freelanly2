import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendApplicationEmail } from '@/lib/email';

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

export const dynamic = 'force-dynamic';

function getCouponEmailHtml(email: string): string {
  const baseStyle = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; }
    .header { background: #000; color: #fff; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .button { display: inline-block; background: #000; color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .offer-box { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: #fff; padding: 24px; border-radius: 12px; margin: 20px 0; text-align: center; }
    .offer-box h3 { margin: 0 0 10px; font-size: 28px; }
    .footer { padding: 20px 30px; background: #f9f9f9; font-size: 12px; color: #666; text-align: center; }
    ul { padding-left: 20px; }
    li { margin: 10px 0; }
  `;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);">
    <h1>You found great projects — now apply directly</h1>
  </div>
  <div class="content">
    <p>Hi there,</p>

    <p>You've been actively browsing freelance projects and jobs on Freelanly — but every time you find a great match, the <strong>contact details are hidden</strong>.</p>

    <p>We'd like to change that. Here's a <strong>special offer</strong> just for you:</p>

    <div class="offer-box">
      <h3>15% OFF PRO</h3>
      <p style="margin: 0; opacity: 0.9;">Get direct access to client contacts</p>
      <p style="margin: 10px 0 0; font-size: 18px;"><strong>Code: QUICK15</strong></p>
    </div>

    <p><strong>With PRO, you can actually apply:</strong></p>
    <ul>
      <li><strong>See contact details</strong> — email, LinkedIn, direct links on every project</li>
      <li><strong>Apply first</strong> — freelance projects get filled fast, reach out before others</li>
      <li><strong>All matching opportunities</strong> — no more hidden results in your alerts</li>
    </ul>

    <p style="text-align: center;">
      <a href="https://freelanly.com/pricing?coupon=QUICK15&source=email_hot_free_campaign" class="button" style="background: #2563eb;">Get Contact Details — 15% Off →</a>
    </p>

    <p style="text-align: center; color: #666; font-size: 14px;">
      Cancel anytime. 100% satisfaction guaranteed.
    </p>

    <p>Best,<br>Fedor<br><em>Founder, Freelanly</em></p>
  </div>
  <div class="footer">
    <p><a href="https://freelanly.com">Freelanly</a> — Remote Jobs for Professionals</p>
    <p><a href="https://freelanly.com/unsubscribe?email=${encodeURIComponent(email)}">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>`;
}

export async function POST() {
  // Check admin access
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Query hot FREE users with clicks (same logic as query 2 in free-users-activity)
    const hotFreeUsers = await prisma.$queryRaw<
      Array<{
        email: string;
        clicks: bigint;
        email_verified: Date | null;
        unsubscribed: boolean;
      }>
    >`
      SELECT
        u."email",
        COUNT(DISTINCT CASE WHEN ee."type" = 'CLICKED' THEN ee."id" END) as clicks,
        u."emailVerified" as email_verified,
        u."unsubscribedFromMarketing" as unsubscribed
      FROM "EmailEvent" ee
      JOIN "User" u ON LOWER(ee."to") = LOWER(u."email")
      WHERE u."plan" = 'FREE'
      GROUP BY u."id", u."email", u."emailVerified", u."unsubscribedFromMarketing"
      HAVING COUNT(DISTINCT CASE WHEN ee."type" = 'CLICKED' THEN ee."id" END) > 0
      ORDER BY clicks DESC
      LIMIT 50
    `;

    // Filter: verified email + not unsubscribed
    const eligibleUsers = hotFreeUsers.filter(
      (u) => u.email_verified !== null && !u.unsubscribed
    );

    let sent = 0;
    let failed = 0;
    let skipped = hotFreeUsers.length - eligibleUsers.length;

    for (const user of eligibleUsers) {
      try {
        const html = getCouponEmailHtml(user.email);
        const result = await sendApplicationEmail({
          to: user.email,
          subject: "You found great projects — now get contact details (15% off)",
          html,
          text: `Hi! You've been browsing great projects on Freelanly but contact details are hidden. Upgrade to PRO and apply directly — 15% off with code QUICK15: https://freelanly.com/pricing?coupon=QUICK15&source=email_hot_free_campaign`,
        });

        if (result.success) {
          sent++;
          console.log(`[CouponCampaign] Sent to ${user.email} (${Number(user.clicks)} clicks)`);
        } else {
          failed++;
          console.error(`[CouponCampaign] Failed for ${user.email}:`, result.error);
        }
      } catch (error) {
        failed++;
        console.error(`[CouponCampaign] Error for ${user.email}:`, error);
      }

      // Rate limit: 200ms between sends
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(`[CouponCampaign] Done: ${sent} sent, ${failed} failed, ${skipped} skipped`);

    return NextResponse.json({ sent, failed, skipped });
  } catch (error) {
    console.error('Coupon campaign error:', error);
    return NextResponse.json(
      { error: 'Failed to send coupon campaign' },
      { status: 500 }
    );
  }
}
