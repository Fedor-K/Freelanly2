/**
 * Abandoned Checkout Email Sequence
 *
 * 10 minutes - IMMEDIATE recovery email with 15% off (QUICK15)
 * 1 hour     - Reminder email
 * 24 hours   - "Complete your upgrade"
 * 3 days     - "Last chance + 20% off" (code: COMEBACK20)
 *
 * Cron runs every 5 minutes to catch 10-minute abandonments quickly
 */

import { prisma } from '@/lib/db';
import { sendApplicationEmail } from '@/lib/email';
import { AbandonedCheckoutEmailType } from '@prisma/client';

// ============================================
// EMAIL TEMPLATES
// ============================================

type AbandonedEmailType = AbandonedCheckoutEmailType;

interface EmailContent {
  subject: string;
  html: string;
}

function getAbVariant(seed: string): 'A' | 'B' | 'C' {
  const idx = parseInt(seed.slice(-2), 16) % 3;
  return (['A', 'B', 'C'] as const)[idx];
}

function getEmailContent(
  emailType: AbandonedEmailType,
  data: { email: string; planName?: string; abVariant?: 'A' | 'B' | 'C' }
): EmailContent {
  const v = data.abVariant || 'A';
  const baseStyle = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; }
    .header { background: #000; color: #fff; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .button { display: inline-block; background: #000; color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button-green { background: #16a34a; }
    .highlight { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .offer-box { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: #fff; padding: 24px; border-radius: 12px; margin: 20px 0; text-align: center; }
    .offer-box h3 { margin: 0 0 10px; font-size: 28px; }
    .footer { padding: 20px 30px; background: #f9f9f9; font-size: 12px; color: #666; text-align: center; }
    ul { padding-left: 20px; }
    li { margin: 10px 0; }
  `;

  switch (emailType) {
    // 10-minute email - IMMEDIATE recovery with discount
    case 'MINUTE_10': {
      const s10 = { A: "Forgot something? Here's 15% off to complete your upgrade", B: "Your PRO access is one click away — 15% off inside", C: "You left PRO behind. Here's a discount to finish." };
      return {
        subject: s10[v],
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}
  .timer { background: #fef2f2; border: 2px solid #fecaca; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0; }
  .timer-text { color: #dc2626; font-weight: 700; font-size: 18px; margin: 0; }
</style></head>
<body>
<div class="container">
  <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
    <h1>Your checkout is waiting!</h1>
  </div>
  <div class="content">
    <p>Hi there,</p>

    <p>I noticed you didn't complete your checkout. No worries — here's a <strong>special discount</strong> to help:</p>

    <div class="offer-box" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
      <h3>15% OFF</h3>
      <p style="margin: 0; opacity: 0.9;">Your first month</p>
      <p style="margin: 10px 0 0; font-size: 18px;"><strong>Code: QUICK15</strong></p>
    </div>

    <p><strong>With PRO, you get:</strong></p>
    <ul>
      <li><strong>Direct contact info</strong> — email hiring managers directly</li>
      <li><strong>Instant job alerts</strong> — be the first to apply</li>
      <li><strong>Unlimited applications</strong> — no more limits</li>
    </ul>

    <p style="text-align: center;">
      <a href="https://freelanly.com/pricing?coupon=QUICK15&source=email_abandoned_10min" class="button" style="background: #dc2626;">Complete My Upgrade →</a>
    </p>

    <p style="text-align: center; color: #666; font-size: 14px;">
      Cancel anytime. 100% satisfaction guaranteed.
    </p>

    <p>Best,<br>Fedor<br><em>Founder, Freelanly</em></p>
  </div>
  <div class="footer">
    <p><a href="https://freelanly.com">Freelanly</a> — Remote Jobs for Professionals</p>
    <p><a href="https://freelanly.com/unsubscribe?email=${encodeURIComponent(data.email)}">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>`,
      };

    }

    // 1 hour email - gentle reminder
    case 'HOUR_1': {
      const s1h = { A: "Still thinking about PRO? Here's what you're missing", B: "Jobs are being filled while you wait", C: "Your checkout expired — but PRO is still waiting for you" };
      return {
        subject: s1h[v],
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
    <h1>Your PRO Access Awaits</h1>
  </div>
  <div class="content">
    <p>Hi there,</p>

    <p>Just checking in — you started upgrading to Freelanly PRO earlier.</p>

    <p><strong>What you're missing right now:</strong></p>
    <ul>
      <li>That job you wanted to apply to? Someone else might get it</li>
      <li><strong>Direct emails & contacts</strong> hidden from FREE users</li>
      <li><strong>INSTANT alerts</strong> — be first to apply, not last</li>
    </ul>

    <p style="text-align: center;">
      <a href="https://freelanly.com/pricing?source=email_abandoned_1h" class="button button-green">Upgrade to PRO Now</a>
    </p>

    <p style="text-align: center; color: #666; font-size: 14px;">
      From €0.39/day. Cancel anytime.
    </p>

    <p>Best,<br>The Freelanly Team</p>
  </div>
  <div class="footer">
    <p><a href="https://freelanly.com">Freelanly</a> — Remote Jobs for Professionals</p>
    <p><a href="https://freelanly.com/unsubscribe?email=${encodeURIComponent(data.email)}">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>`,
      };

    }

    // 24 hour email - social proof
    case 'HOUR_24': {
      const s24 = { A: "Complete your Freelanly PRO upgrade", B: "43 members upgraded this month. You're close.", C: "One thing standing between you and direct job contacts" };
      return {
        subject: s24[v],
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
    <h1>Don't Miss Out</h1>
  </div>
  <div class="content">
    <p>Hi there,</p>

    <p>Yesterday you were checking out Freelanly PRO. Here's what you're missing:</p>

    <ul>
      <li><strong>347 new remote jobs</strong> posted in the last 24 hours</li>
      <li>PRO members applied to <strong>89 jobs</strong> yesterday</li>
      <li>Average response time with direct contact: <strong>2 days</strong> (vs 2 weeks on job boards)</li>
    </ul>

    <p>Your competitors are already applying. Don't let the best opportunities slip away.</p>

    <p style="text-align: center;">
      <a href="https://freelanly.com/pricing?source=email_abandoned_24h" class="button button-green">Upgrade to PRO Now</a>
    </p>

    <p style="text-align: center; color: #666; font-size: 12px;">
      From €0.39/day. Cancel anytime.
    </p>

    <p>Best,<br>The Freelanly Team</p>
  </div>
  <div class="footer">
    <p><a href="https://freelanly.com">Freelanly</a> — Remote Jobs for Professionals</p>
    <p><a href="https://freelanly.com/unsubscribe?email=${encodeURIComponent(data.email)}">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>`,
      };

    }

    // 3 day email - last chance with bigger discount
    case 'DAY_3': {
      const s3d = { A: "Last chance: 20% off your first month", B: "Final offer: apply directly to jobs for €12/month", C: "This is your last discount — 20% off expires soon" };
      return {
        subject: 'Last chance: 20% off your first month',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header" style="background: #dc2626;">
    <h1>Special Offer Inside</h1>
  </div>
  <div class="content">
    <p>Hi there,</p>

    <p>This is my last email about Freelanly PRO. I wanted to offer you something special:</p>

    <div class="offer-box" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
      <h3>20% OFF</h3>
      <p style="margin: 0; opacity: 0.9;">Your first month</p>
      <p style="margin: 10px 0 0; font-size: 14px; opacity: 0.8;">Use code: <strong>COMEBACK20</strong></p>
    </div>

    <p>Here's the deal:</p>
    <ul>
      <li>Upgrade to <strong>PRO</strong> today</li>
      <li>Use code <strong>COMEBACK20</strong> for 20% off your first month</li>
      <li>Cancel anytime if it's not for you</li>
    </ul>

    <p style="text-align: center;">
      <a href="https://freelanly.com/pricing?coupon=COMEBACK20&source=email_abandoned_3d" class="button" style="background: #dc2626;">Claim Your 20% Discount</a>
    </p>

    <p style="text-align: center; color: #666; font-size: 14px;">
      Offer expires in 48 hours
    </p>

    <p>This is the last email I'll send about this. If remote work isn't your thing right now, I understand. But if you're still looking — this is the best deal you'll get.</p>

    <p>Best,<br>Fedor<br><em>Founder, Freelanly</em></p>
  </div>
  <div class="footer">
    <p><a href="https://freelanly.com">Freelanly</a> — Remote Jobs for Professionals</p>
    <p><a href="https://freelanly.com/unsubscribe?email=${encodeURIComponent(data.email)}">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>`,
      };
    }

    default:
      throw new Error(`Unknown email type: ${emailType}`);
  }
}

// ============================================
// MAIN PROCESSING (Using Database)
// ============================================

interface AbandonedSession {
  id: string;
  stripeSessionId: string;
  email: string;
  createdAt: Date;
  minutesSinceCreated: number;
  priceKey: string;
}

/**
 * Get abandoned checkout sessions from our database
 * Returns only the EARLIEST pending session per user email
 * to prevent duplicate emails when user creates multiple checkout sessions
 */
async function getAbandonedSessions(): Promise<AbandonedSession[]> {
  // Get pending sessions from last 4 days
  const fourDaysAgo = new Date();
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

  const sessions = await prisma.checkoutSession.findMany({
    where: {
      status: 'PENDING',
      createdAt: { gte: fourDaysAgo },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Deduplicate: keep only the earliest session per email
  const earliestByEmail = new Map<string, (typeof sessions)[0]>();
  for (const session of sessions) {
    if (!earliestByEmail.has(session.email)) {
      earliestByEmail.set(session.email, session);
    }
  }

  return Array.from(earliestByEmail.values()).map((session) => {
    const minutesSinceCreated = (Date.now() - session.createdAt.getTime()) / (1000 * 60);
    return {
      id: session.id,
      stripeSessionId: session.stripeSessionId,
      email: session.email,
      createdAt: session.createdAt,
      minutesSinceCreated,
      priceKey: session.priceKey,
    };
  });
}

/**
 * Determine which email to send based on minutes since checkout
 * Cron runs every 5 minutes
 */
function getEmailTypeForMinutes(minutes: number): AbandonedEmailType | null {
  // 10 minutes (10-20 min window)
  if (minutes >= 10 && minutes < 20) {
    return 'MINUTE_10';
  }
  // 1 hour (55-70 min window)
  if (minutes >= 55 && minutes < 70) {
    return 'HOUR_1';
  }
  // 24 hours (23-25 hour window = 1380-1500 minutes)
  if (minutes >= 1380 && minutes < 1500) {
    return 'HOUR_24';
  }
  // 3 days (70-74 hour window = 4200-4440 minutes)
  if (minutes >= 4200 && minutes < 4440) {
    return 'DAY_3';
  }
  return null;
}

/**
 * Check if this email type was already sent to this user (by email address)
 * Deduplicates by email, not by sessionId, to prevent duplicate emails
 * when user creates multiple checkout sessions
 */
async function wasEmailSent(email: string, emailType: AbandonedEmailType): Promise<boolean> {
  const existing = await prisma.abandonedCheckoutEmail.findFirst({
    where: {
      email,
      emailType,
    },
  });
  return !!existing;
}

/**
 * Record that email was sent
 */
async function recordEmailSent(
  sessionId: string,
  email: string,
  emailType: AbandonedEmailType,
  abVariant?: string
): Promise<void> {
  await prisma.abandonedCheckoutEmail.create({
    data: {
      sessionId,
      email,
      emailType,
      ...(abVariant ? { abVariant } : {}),
    },
  });
}

/**
 * Check if user has unsubscribed from marketing
 */
async function hasUnsubscribed(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { unsubscribedFromMarketing: true },
  });
  return user?.unsubscribedFromMarketing ?? false;
}

/**
 * Send abandoned checkout email
 */
async function sendAbandonedEmail(
  session: AbandonedSession,
  emailType: AbandonedEmailType
): Promise<{ success: boolean; variant: 'A' | 'B' | 'C' }> {
  const variant = getAbVariant(session.email);
  const content = getEmailContent(emailType, {
    email: session.email,
    planName: session.priceKey,
    abVariant: variant,
  });

  const result = await sendApplicationEmail({
    to: session.email,
    subject: content.subject,
    html: content.html,
  });

  return { success: result.success, variant };
}

/**
 * Main function: Process all abandoned checkout emails
 * Should be called by cron every 5 minutes
 */
export async function processAbandonedCheckoutEmails(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  alreadySubscribed: number;
  failed: number;
  details: Array<{ email: string; emailType: string; status: string }>;
}> {
  const stats = {
    processed: 0,
    sent: 0,
    skipped: 0,
    alreadySubscribed: 0,
    failed: 0,
    details: [] as Array<{ email: string; emailType: string; status: string }>,
  };

  try {
    const abandonedSessions = await getAbandonedSessions();
    console.log(`[AbandonedCheckout] Found ${abandonedSessions.length} pending checkout sessions`);

    for (const session of abandonedSessions) {
      stats.processed++;

      // Check if user has already subscribed (with actual Stripe subscription)
      const user = await prisma.user.findUnique({
        where: { email: session.email },
        select: { plan: true, stripeSubscriptionId: true },
      });
      // Only skip if user is PRO with active Stripe subscription (not manual PRO)
      if (user?.plan === 'PRO' && user?.stripeSubscriptionId) {
        stats.alreadySubscribed++;
        continue;
      }

      // Check if user has unsubscribed from marketing emails
      const unsubscribed = await hasUnsubscribed(session.email);
      if (unsubscribed) {
        stats.skipped++;
        continue;
      }

      const emailType = getEmailTypeForMinutes(session.minutesSinceCreated);
      if (!emailType) {
        // Not in a time window for sending emails
        continue;
      }

      // Check if already sent this email type (by user email, not session)
      const alreadySent = await wasEmailSent(session.email, emailType);
      if (alreadySent) {
        stats.skipped++;
        continue;
      }

      // Send email
      const minutesAgo = Math.round(session.minutesSinceCreated);
      console.log(`[AbandonedCheckout] Sending ${emailType} to ${session.email} (${minutesAgo} min ago)`);
      const { success, variant } = await sendAbandonedEmail(session, emailType);

      if (success) {
        await recordEmailSent(session.stripeSessionId, session.email, emailType, variant);
        stats.sent++;
        stats.details.push({ email: session.email, emailType, status: 'sent' });
        console.log(`[AbandonedCheckout] Sent ${emailType} to ${session.email}`);
      } else {
        stats.failed++;
        stats.details.push({ email: session.email, emailType, status: 'failed' });
        console.error(`[AbandonedCheckout] Failed to send ${emailType} to ${session.email}`);
      }
    }
  } catch (error) {
    console.error('[AbandonedCheckout] Error processing emails:', error);
    throw error;
  }

  return stats;
}

/**
 * Get abandoned checkout email statistics
 */
export async function getAbandonedCheckoutStats(): Promise<{
  totalSent: number;
  byType: Record<string, number>;
  converted: number;
  last7Days: number;
}> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [totalSent, byType, converted, last7Days] = await Promise.all([
    prisma.abandonedCheckoutEmail.count(),
    prisma.abandonedCheckoutEmail.groupBy({
      by: ['emailType'],
      _count: true,
    }),
    prisma.abandonedCheckoutEmail.count({
      where: { convertedAt: { not: null } },
    }),
    prisma.abandonedCheckoutEmail.count({
      where: { sentAt: { gte: sevenDaysAgo } },
    }),
  ]);

  const byTypeMap: Record<string, number> = {};
  for (const item of byType) {
    byTypeMap[item.emailType] = item._count;
  }

  return {
    totalSent,
    byType: byTypeMap,
    converted,
    last7Days,
  };
}
