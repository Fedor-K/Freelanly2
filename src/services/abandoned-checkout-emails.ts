/**
 * Abandoned Checkout Email Sequence
 *
 * 1 hour   - "Complete your checkout"
 * 24 hours - "Your free trial is waiting"
 * 3 days   - "Last chance + 20% off"
 */

import { prisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { sendApplicationEmail } from '@/lib/dashamail';
import { AbandonedCheckoutEmailType } from '@prisma/client';

// ============================================
// EMAIL TEMPLATES
// ============================================

type AbandonedEmailType = AbandonedCheckoutEmailType;

interface EmailContent {
  subject: string;
  html: string;
}

function getEmailContent(
  emailType: AbandonedEmailType,
  data: { email: string; planName?: string }
): EmailContent {
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
    case 'HOUR_1':
      return {
        subject: 'Complete your Freelanly registration',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>Almost There!</h1>
  </div>
  <div class="content">
    <p>Hi there,</p>

    <p>We noticed you started signing up for Freelanly PRO but didn't finish. No worries — your <strong>7-day free trial</strong> is still waiting for you!</p>

    <div class="highlight">
      <p style="margin: 0;"><strong>What you'll get with PRO:</strong></p>
      <ul style="margin: 10px 0 0;">
        <li>Apply to <strong>unlimited remote jobs</strong></li>
        <li>See <strong>direct contact info</strong> (emails, phones)</li>
        <li><strong>Full salary insights</strong> with market data</li>
        <li><strong>INSTANT job alerts</strong> — be first to apply</li>
      </ul>
    </div>

    <p style="text-align: center;">
      <a href="https://freelanly.com/pricing" class="button">Start Your Free Trial</a>
    </p>

    <p style="text-align: center; color: #666; font-size: 14px;">
      No charge for 7 days. Cancel anytime.
    </p>

    <p>Questions? Just reply to this email.</p>

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

    case 'HOUR_24':
      return {
        subject: 'Your 7-day free trial is waiting',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
    <h1>Your Free Trial Awaits</h1>
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
      <a href="https://freelanly.com/pricing" class="button button-green">Start Free Trial — No Card Needed*</a>
    </p>

    <p style="text-align: center; color: #666; font-size: 12px;">
      *Card required but not charged for 7 days
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

    case 'DAY_3':
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

    <p>This is my last email about your Freelanly trial. I wanted to offer you something special:</p>

    <div class="offer-box" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
      <h3>20% OFF</h3>
      <p style="margin: 0; opacity: 0.9;">Your first month after trial</p>
      <p style="margin: 10px 0 0; font-size: 14px; opacity: 0.8;">Use code: <strong>WELCOME20</strong></p>
    </div>

    <p>Here's the deal:</p>
    <ul>
      <li>Start your <strong>7-day free trial</strong> today</li>
      <li>If you love it, use code <strong>WELCOME20</strong> for 20% off</li>
      <li>If not, cancel before day 7 — no charge</li>
    </ul>

    <p style="text-align: center;">
      <a href="https://freelanly.com/pricing?coupon=WELCOME20" class="button" style="background: #dc2626;">Claim Your 20% Discount</a>
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

    default:
      throw new Error(`Unknown email type: ${emailType}`);
  }
}

// ============================================
// MAIN PROCESSING
// ============================================

interface AbandonedSession {
  sessionId: string;
  email: string;
  createdAt: Date;
  hoursSinceCreated: number;
  planName: string;
  status: string;
}

/**
 * Get abandoned checkout sessions from Stripe
 */
async function getAbandonedSessions(): Promise<AbandonedSession[]> {
  const stripe = getStripe();

  // Get sessions from last 4 days
  const fourDaysAgo = Math.floor((Date.now() - 4 * 24 * 60 * 60 * 1000) / 1000);

  const sessions = await stripe.checkout.sessions.list({
    limit: 100,
    created: { gte: fourDaysAgo },
  });

  const result: AbandonedSession[] = [];

  for (const session of sessions.data) {
    // Only process incomplete sessions
    if (session.status === 'complete') continue;
    if (!session.customer_email) continue;

    const createdAt = new Date(session.created * 1000);
    const hoursSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

    // Get plan name from metadata or line items
    let planName = 'PRO';
    if (session.metadata?.plan) {
      planName = session.metadata.plan;
    }

    result.push({
      sessionId: session.id,
      email: session.customer_email,
      createdAt,
      hoursSinceCreated,
      planName,
      status: session.status || 'unknown',
    });
  }

  return result;
}

/**
 * Determine which email to send based on hours since checkout
 */
function getEmailTypeForHours(hours: number): AbandonedEmailType | null {
  // 1 hour (with 30 min buffer)
  if (hours >= 1 && hours < 2) {
    return 'HOUR_1';
  }
  // 24 hours (with 2 hour buffer)
  if (hours >= 24 && hours < 26) {
    return 'HOUR_24';
  }
  // 3 days (72 hours, with 4 hour buffer)
  if (hours >= 72 && hours < 76) {
    return 'DAY_3';
  }
  return null;
}

/**
 * Check if email was already sent for this session/type
 */
async function wasEmailSent(sessionId: string, emailType: AbandonedEmailType): Promise<boolean> {
  const existing = await prisma.abandonedCheckoutEmail.findUnique({
    where: {
      sessionId_emailType: {
        sessionId,
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
  sessionId: string,
  email: string,
  emailType: AbandonedEmailType
): Promise<void> {
  await prisma.abandonedCheckoutEmail.create({
    data: {
      sessionId,
      email,
      emailType,
    },
  });
}

/**
 * Check if user has already subscribed
 */
async function hasSubscribed(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { plan: true },
  });
  return user?.plan === 'PRO';
}

/**
 * Send abandoned checkout email
 */
async function sendAbandonedEmail(
  session: AbandonedSession,
  emailType: AbandonedEmailType
): Promise<boolean> {
  const content = getEmailContent(emailType, {
    email: session.email,
    planName: session.planName,
  });

  const result = await sendApplicationEmail({
    to: session.email,
    subject: content.subject,
    html: content.html,
  });

  return result.success;
}

/**
 * Main function: Process all abandoned checkout emails
 * Should be called by cron every hour
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
    console.log(`[AbandonedCheckout] Found ${abandonedSessions.length} abandoned sessions`);

    for (const session of abandonedSessions) {
      stats.processed++;

      // Check if user has already subscribed
      const subscribed = await hasSubscribed(session.email);
      if (subscribed) {
        stats.alreadySubscribed++;
        continue;
      }

      const emailType = getEmailTypeForHours(session.hoursSinceCreated);
      if (!emailType) {
        // Not a time we send emails
        continue;
      }

      // Check if already sent
      const alreadySent = await wasEmailSent(session.sessionId, emailType);
      if (alreadySent) {
        stats.skipped++;
        continue;
      }

      // Send email
      console.log(`[AbandonedCheckout] Sending ${emailType} to ${session.email} (${Math.round(session.hoursSinceCreated)}h ago)`);
      const success = await sendAbandonedEmail(session, emailType);

      if (success) {
        await recordEmailSent(session.sessionId, session.email, emailType);
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
