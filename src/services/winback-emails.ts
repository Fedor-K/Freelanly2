/**
 * Win-back Email Sequence for Churned Users
 *
 * Day 7  - "We miss you" + what's new
 * Day 14 - Special offer (50% off)
 * Day 30 - Last chance offer
 */

import { prisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { sendApplicationEmail } from '@/lib/dashamail';
import { WinbackEmailType } from '@prisma/client';

// ============================================
// EMAIL TEMPLATES
// ============================================

interface WinbackEmailContent {
  subject: string;
  html: string;
}

function getWinbackEmailContent(
  emailType: WinbackEmailType,
  data: { email: string }
): WinbackEmailContent {
  const baseStyle = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; }
    .header { background: #000; color: #fff; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .button { display: inline-block; background: #000; color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button-purple { background: #9333ea; }
    .button-purple:hover { background: #7e22ce; }
    .highlight { background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .offer-box { background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%); color: #fff; padding: 24px; border-radius: 12px; margin: 20px 0; text-align: center; }
    .offer-box h3 { margin: 0 0 10px; font-size: 28px; }
    .footer { padding: 20px 30px; background: #f9f9f9; font-size: 12px; color: #666; text-align: center; }
    ul { padding-left: 20px; }
    li { margin: 10px 0; }
  `;

  switch (emailType) {
    case 'DAY_7_MISS_YOU':
      return {
        subject: 'We miss you at Freelanly',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>We Miss You!</h1>
  </div>
  <div class="content">
    <p>Hi there,</p>

    <p>It's been a week since you left Freelanly, and we wanted to check in.</p>

    <p>Since you've been gone, we've been busy adding:</p>

    <ul>
      <li><strong>More job sources</strong> - We're now aggregating from even more platforms</li>
      <li><strong>Faster alerts</strong> - INSTANT alerts now send within minutes</li>
      <li><strong>Better matching</strong> - Improved job matching for your skills</li>
    </ul>

    <p>If your circumstances have changed or you're back on the job hunt, we'd love to have you back.</p>

    <p style="text-align: center;">
      <a href="https://freelanly.com/pricing" class="button">Come Back to PRO</a>
    </p>

    <p>If there's something specific that made you leave, we'd love to hear about it. Just reply to this email.</p>

    <p>Best,<br>The Freelanly Team</p>
  </div>
  <div class="footer">
    <p>You're receiving this because you were previously a PRO member at <a href="https://freelanly.com">Freelanly</a>.</p>
    <p><a href="https://freelanly.com/unsubscribe?email=${encodeURIComponent(data.email)}">Unsubscribe from these emails</a></p>
  </div>
</div>
</body>
</html>`,
      };

    case 'DAY_14_SPECIAL_OFFER':
      return {
        subject: 'Special offer: 50% off to come back',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header" style="background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%);">
    <h1>A Special Offer for You</h1>
  </div>
  <div class="content">
    <p>Hi there,</p>

    <p>We really valued having you as a PRO member, and we'd love to welcome you back.</p>

    <div class="offer-box">
      <h3>50% OFF</h3>
      <p style="margin: 0; opacity: 0.9;">Your first month back</p>
      <p style="margin: 10px 0 0; font-size: 14px; opacity: 0.8;">That's just €10 for full PRO access</p>
    </div>

    <p>With PRO, you get:</p>
    <ul>
      <li>Apply to <strong>unlimited jobs</strong></li>
      <li>See <strong>contact emails</strong> and phone numbers</li>
      <li><strong>Full salary insights</strong> with market data</li>
      <li><strong>INSTANT job alerts</strong> - be first to apply</li>
    </ul>

    <p style="text-align: center;">
      <a href="https://freelanly.com/pricing?coupon=COMEBACK50" class="button button-purple">Claim Your 50% Discount</a>
    </p>

    <p style="text-align: center; color: #666; font-size: 14px;">
      Offer expires in 7 days
    </p>

    <p>Best,<br>The Freelanly Team</p>
  </div>
  <div class="footer">
    <p>You're receiving this because you were previously a PRO member at <a href="https://freelanly.com">Freelanly</a>.</p>
    <p><a href="https://freelanly.com/unsubscribe?email=${encodeURIComponent(data.email)}">Unsubscribe from these emails</a></p>
  </div>
</div>
</body>
</html>`,
      };

    case 'DAY_30_LAST_CHANCE':
      return {
        subject: 'Last chance: Your 60% off offer expires soon',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header" style="background: #dc2626;">
    <h1>Final Offer</h1>
  </div>
  <div class="content">
    <p>Hi there,</p>

    <p>It's been a month since you left Freelanly. This is our final attempt to win you back with our <strong>best offer ever</strong>.</p>

    <div class="offer-box" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
      <h3>60% OFF</h3>
      <p style="margin: 0; opacity: 0.9;">Your first month back</p>
      <p style="margin: 10px 0 0; font-size: 14px; opacity: 0.8;">Just €8 for full PRO access</p>
    </div>

    <p>Think about it:</p>
    <ul>
      <li>One successful job application could change your career</li>
      <li>€8 is less than a lunch — but could lead to €1000s more in salary</li>
      <li>You've already set up alerts — they're waiting for you</li>
    </ul>

    <p style="text-align: center;">
      <a href="https://freelanly.com/pricing?coupon=LASTCHANCE60" class="button" style="background: #dc2626;">Claim 60% Off - Final Offer</a>
    </p>

    <p style="text-align: center; color: #666; font-size: 14px;">
      This offer expires in 48 hours and won't be offered again.
    </p>

    <p>If remote work isn't for you anymore, we understand. But if you're still looking, we're here to help.</p>

    <p>Best,<br>The Freelanly Team</p>
  </div>
  <div class="footer">
    <p>You're receiving this because you were previously a PRO member at <a href="https://freelanly.com">Freelanly</a>.</p>
    <p>This is our last email. <a href="https://freelanly.com/unsubscribe?email=${encodeURIComponent(data.email)}">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>`,
      };

    default:
      throw new Error(`Unknown winback email type: ${emailType}`);
  }
}

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================

interface ChurnedSubscription {
  customerId: string;
  email: string;
  canceledAt: Date;
  daysSinceCancel: number;
  planAtCancel: string;
}

/**
 * Get all recently churned subscriptions from Stripe
 */
async function getChurnedSubscriptions(): Promise<ChurnedSubscription[]> {
  const stripe = getStripe();

  // Get subscriptions canceled in the last 35 days
  const thirtyFiveDaysAgo = Math.floor((Date.now() - 35 * 24 * 60 * 60 * 1000) / 1000);

  const subscriptions = await stripe.subscriptions.list({
    status: 'canceled',
    limit: 100,
    expand: ['data.customer'],
    created: { gte: thirtyFiveDaysAgo },
  });

  const result: ChurnedSubscription[] = [];

  for (const sub of subscriptions.data) {
    const customer = sub.customer as { id: string; email?: string | null };
    if (!customer?.email) continue;

    const canceledAt = sub.canceled_at
      ? new Date(sub.canceled_at * 1000)
      : sub.ended_at
      ? new Date(sub.ended_at * 1000)
      : null;

    if (!canceledAt) continue;

    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceCancel = Math.floor((now.getTime() - canceledAt.getTime()) / msPerDay);

    // Get plan type
    let planAtCancel = 'monthly';
    const priceId = sub.items.data[0]?.price?.id;
    if (priceId?.includes('weekly') || sub.items.data[0]?.price?.recurring?.interval === 'week') {
      planAtCancel = 'weekly';
    } else if (priceId?.includes('annual') || sub.items.data[0]?.price?.recurring?.interval === 'year') {
      planAtCancel = 'annual';
    }

    result.push({
      customerId: customer.id,
      email: customer.email,
      canceledAt,
      daysSinceCancel,
      planAtCancel,
    });
  }

  return result;
}

/**
 * Get which email should be sent based on days since cancel
 */
function getEmailTypeForDays(daysSinceCancel: number): WinbackEmailType | null {
  // Send on exact days (with 1-day buffer for cron timing)
  if (daysSinceCancel >= 7 && daysSinceCancel <= 8) {
    return 'DAY_7_MISS_YOU';
  }
  if (daysSinceCancel >= 14 && daysSinceCancel <= 15) {
    return 'DAY_14_SPECIAL_OFFER';
  }
  if (daysSinceCancel >= 30 && daysSinceCancel <= 31) {
    return 'DAY_30_LAST_CHANCE';
  }
  return null;
}

/**
 * Check if email was already sent
 */
async function wasEmailSent(email: string, emailType: WinbackEmailType): Promise<boolean> {
  const existing = await prisma.winbackEmail.findUnique({
    where: {
      email_emailType: {
        email,
        emailType,
      },
    },
  });
  return !!existing;
}

/**
 * Record that email was sent
 */
async function recordEmailSent(
  email: string,
  customerId: string,
  emailType: WinbackEmailType,
  canceledAt: Date,
  planAtCancel: string
): Promise<void> {
  await prisma.winbackEmail.create({
    data: {
      email,
      stripeCustomerId: customerId,
      emailType,
      canceledAt,
      planAtCancel,
    },
  });
}

/**
 * Check if user has resubscribed
 */
async function hasResubscribed(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { plan: true, stripeSubscriptionId: true },
  });
  return user?.plan === 'PRO' && !!user?.stripeSubscriptionId;
}

/**
 * Send winback email
 */
async function sendWinbackEmail(
  churned: ChurnedSubscription,
  emailType: WinbackEmailType
): Promise<boolean> {
  const content = getWinbackEmailContent(emailType, { email: churned.email });

  const result = await sendApplicationEmail({
    to: churned.email,
    subject: content.subject,
    html: content.html,
  });

  return result.success;
}

/**
 * Main function: Process all win-back emails
 * Should be called by cron daily
 */
export async function processWinbackEmails(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  resubscribed: number;
  failed: number;
  details: Array<{ email: string; emailType: string; status: string }>;
}> {
  const stats = {
    processed: 0,
    sent: 0,
    skipped: 0,
    resubscribed: 0,
    failed: 0,
    details: [] as Array<{ email: string; emailType: string; status: string }>,
  };

  try {
    const churnedSubscriptions = await getChurnedSubscriptions();
    console.log(`[WinbackEmails] Found ${churnedSubscriptions.length} churned subscriptions`);

    for (const churned of churnedSubscriptions) {
      stats.processed++;

      // Check if user has resubscribed
      const resubscribed = await hasResubscribed(churned.email);
      if (resubscribed) {
        stats.resubscribed++;
        continue;
      }

      const emailType = getEmailTypeForDays(churned.daysSinceCancel);
      if (!emailType) {
        // Not a day we send emails
        continue;
      }

      // Check if already sent
      const alreadySent = await wasEmailSent(churned.email, emailType);
      if (alreadySent) {
        stats.skipped++;
        continue;
      }

      // Send email
      console.log(`[WinbackEmails] Sending ${emailType} to ${churned.email} (${churned.daysSinceCancel} days since cancel)`);
      const success = await sendWinbackEmail(churned, emailType);

      if (success) {
        await recordEmailSent(
          churned.email,
          churned.customerId,
          emailType,
          churned.canceledAt,
          churned.planAtCancel
        );
        stats.sent++;
        stats.details.push({ email: churned.email, emailType, status: 'sent' });
        console.log(`[WinbackEmails] Sent ${emailType} to ${churned.email}`);
      } else {
        stats.failed++;
        stats.details.push({ email: churned.email, emailType, status: 'failed' });
        console.error(`[WinbackEmails] Failed to send ${emailType} to ${churned.email}`);
      }
    }
  } catch (error) {
    console.error('[WinbackEmails] Error processing win-back emails:', error);
    throw error;
  }

  return stats;
}

/**
 * Get win-back email statistics
 */
export async function getWinbackEmailStats(): Promise<{
  totalSent: number;
  byType: Record<string, number>;
  resubscribed: number;
  last30Days: number;
}> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [totalSent, byType, resubscribed, last30Days] = await Promise.all([
    prisma.winbackEmail.count(),
    prisma.winbackEmail.groupBy({
      by: ['emailType'],
      _count: true,
    }),
    prisma.winbackEmail.count({
      where: {
        resubscribedAt: { not: null },
      },
    }),
    prisma.winbackEmail.count({
      where: {
        sentAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  const byTypeMap: Record<string, number> = {};
  for (const item of byType) {
    byTypeMap[item.emailType] = item._count;
  }

  return {
    totalSent,
    byType: byTypeMap,
    resubscribed,
    last30Days,
  };
}
