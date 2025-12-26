/**
 * Trial Email Onboarding Sequence
 *
 * Day 0 - Welcome: Explain PRO value
 * Day 2 - Features: Show what they're missing
 * Day 5 - Social Proof: Testimonials
 * Day 6 - Urgency: Trial ending tomorrow
 * Day 7 - Last Chance: Final reminder
 */

import { prisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { sendApplicationEmail } from '@/lib/dashamail';
import { TrialEmailType } from '@prisma/client';

// ============================================
// EMAIL TEMPLATES
// ============================================

interface TrialEmailContent {
  subject: string;
  html: string;
}

function getTrialEmailContent(
  emailType: TrialEmailType,
  data: { email: string; trialEndDate: Date }
): TrialEmailContent {
  const trialEndFormatted = data.trialEndDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });

  const baseStyle = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; }
    .header { background: #000; color: #fff; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .button { display: inline-block; background: #000; color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #333; }
    .highlight { background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .feature { display: flex; align-items: center; margin: 15px 0; }
    .feature-icon { font-size: 24px; margin-right: 15px; }
    .footer { padding: 20px 30px; background: #f9f9f9; font-size: 12px; color: #666; text-align: center; }
    .urgent { color: #dc2626; font-weight: 600; }
    ul { padding-left: 20px; }
    li { margin: 10px 0; }
  `;

  switch (emailType) {
    case 'DAY_0_WELCOME':
      return {
        subject: 'Welcome to Freelanly PRO Trial!',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>Welcome to PRO!</h1>
  </div>
  <div class="content">
    <p>Hi there!</p>

    <p>You've just started your <strong>7-day free trial</strong> of Freelanly PRO. Here's what you can do now:</p>

    <div class="highlight">
      <div class="feature"><span class="feature-icon">✅</span> <strong>Apply to unlimited jobs</strong> - no restrictions</div>
      <div class="feature"><span class="feature-icon">📧</span> <strong>See contact emails</strong> - reach companies directly</div>
      <div class="feature"><span class="feature-icon">💰</span> <strong>Full salary insights</strong> - know your market value</div>
      <div class="feature"><span class="feature-icon">⚡</span> <strong>INSTANT job alerts</strong> - be first to apply</div>
    </div>

    <p><strong>Pro tip:</strong> Set up a job alert now to get notified about new opportunities instantly.</p>

    <p style="text-align: center;">
      <a href="https://freelanly.com/dashboard/alerts" class="button">Set Up Job Alerts</a>
    </p>

    <p>Your trial ends on <strong>${trialEndFormatted}</strong>. Use this time to explore everything PRO has to offer!</p>

    <p>Questions? Just reply to this email.</p>

    <p>Best,<br>The Freelanly Team</p>
  </div>
  <div class="footer">
    <p>You're receiving this because you started a trial on <a href="https://freelanly.com">Freelanly</a>.</p>
  </div>
</div>
</body>
</html>`,
      };

    case 'DAY_2_FEATURES':
      return {
        subject: 'Are you using these PRO features?',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>Getting the Most from PRO</h1>
  </div>
  <div class="content">
    <p>Hi!</p>

    <p>You're 2 days into your PRO trial. Here are some features you might not have discovered yet:</p>

    <div class="highlight">
      <h3 style="margin-top: 0;">💼 Direct Contact Info</h3>
      <p>PRO users see company emails and contact details hidden from free users. This means you can reach out directly instead of going through forms.</p>
    </div>

    <div class="highlight">
      <h3 style="margin-top: 0;">📊 Salary Insights</h3>
      <p>See the full salary range, percentiles, and market data for every job. Know if you're being offered fair compensation.</p>
    </div>

    <div class="highlight">
      <h3 style="margin-top: 0;">⚡ INSTANT Alerts</h3>
      <p>Get notified within minutes of new jobs being posted. Being first to apply dramatically increases your chances.</p>
    </div>

    <p style="text-align: center;">
      <a href="https://freelanly.com/jobs" class="button">Browse Jobs Now</a>
    </p>

    <p>Remember, your trial ends on <strong>${trialEndFormatted}</strong>.</p>

    <p>Best,<br>The Freelanly Team</p>
  </div>
  <div class="footer">
    <p>You're receiving this because you're on a PRO trial on <a href="https://freelanly.com">Freelanly</a>.</p>
  </div>
</div>
</body>
</html>`,
      };

    case 'DAY_5_SOCIAL_PROOF':
      return {
        subject: 'How freelancers find remote jobs faster',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>Success Stories</h1>
  </div>
  <div class="content">
    <p>Hi!</p>

    <p>Your trial is going strong! Here's how other PRO members are finding success:</p>

    <div class="highlight">
      <p><em>"I found my dream remote job within 2 weeks of using PRO. The instant alerts let me be one of the first applicants."</em></p>
      <p style="margin-bottom: 0;"><strong>— Sarah, UX Designer</strong></p>
    </div>

    <div class="highlight">
      <p><em>"The salary insights helped me negotiate 15% higher than the initial offer. Paid for years of PRO subscription!"</em></p>
      <p style="margin-bottom: 0;"><strong>— Alex, Software Engineer</strong></p>
    </div>

    <div class="highlight">
      <p><em>"Having direct contact emails means I can skip the application forms and reach hiring managers directly."</em></p>
      <p style="margin-bottom: 0;"><strong>— Maria, Content Writer</strong></p>
    </div>

    <p><strong>What's your goal?</strong> Whether you're looking for your first remote job or upgrading your current situation, PRO gives you the tools to get there faster.</p>

    <p style="text-align: center;">
      <a href="https://freelanly.com/jobs" class="button">Find Your Next Job</a>
    </p>

    <p>Your trial ends on <strong>${trialEndFormatted}</strong>.</p>

    <p>Best,<br>The Freelanly Team</p>
  </div>
  <div class="footer">
    <p>You're receiving this because you're on a PRO trial on <a href="https://freelanly.com">Freelanly</a>.</p>
  </div>
</div>
</body>
</html>`,
      };

    case 'DAY_6_URGENCY':
      return {
        subject: 'Your PRO trial ends tomorrow',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header" style="background: #dc2626;">
    <h1>Trial Ending Tomorrow</h1>
  </div>
  <div class="content">
    <p>Hi!</p>

    <p class="urgent">Your PRO trial ends tomorrow (${trialEndFormatted}).</p>

    <p>After your trial ends, you'll lose access to:</p>

    <ul>
      <li><strong>Applying to jobs</strong> - applications will be blocked</li>
      <li><strong>Contact information</strong> - emails and phones will be hidden</li>
      <li><strong>Full salary data</strong> - only averages will be shown</li>
      <li><strong>INSTANT alerts</strong> - back to daily digests only</li>
    </ul>

    <div class="highlight">
      <h3 style="margin-top: 0;">Continue for just €20/month</h3>
      <p>Or save 20% with annual billing (€16/month).</p>
      <p style="margin-bottom: 0;"><strong>That's less than one hour of freelance work.</strong></p>
    </div>

    <p style="text-align: center;">
      <a href="https://freelanly.com/pricing" class="button">Keep PRO Access</a>
    </p>

    <p>Don't lose momentum in your job search!</p>

    <p>Best,<br>The Freelanly Team</p>
  </div>
  <div class="footer">
    <p>You're receiving this because your PRO trial on <a href="https://freelanly.com">Freelanly</a> is ending.</p>
  </div>
</div>
</body>
</html>`,
      };

    case 'DAY_7_LAST_CHANCE':
      return {
        subject: '⏰ Last day of your PRO trial',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header" style="background: #dc2626;">
    <h1>Last Day!</h1>
  </div>
  <div class="content">
    <p>Hi!</p>

    <p class="urgent">This is your last day with PRO access.</p>

    <p>At midnight tonight, your trial ends and you'll be downgraded to the free plan.</p>

    <div class="highlight" style="background: #fef2f2; border: 1px solid #fecaca;">
      <h3 style="margin-top: 0; color: #dc2626;">What you'll lose:</h3>
      <ul style="margin-bottom: 0;">
        <li>Ability to apply to jobs</li>
        <li>Company contact information</li>
        <li>Full salary insights</li>
        <li>INSTANT job alerts</li>
      </ul>
    </div>

    <p><strong>If you've found value in PRO during this trial</strong>, now is the time to subscribe and keep your job search moving forward.</p>

    <p style="text-align: center;">
      <a href="https://freelanly.com/pricing" class="button" style="background: #dc2626;">Subscribe Now - Keep PRO</a>
    </p>

    <p style="text-align: center; color: #666; font-size: 14px;">
      Monthly: €20 | Annual: €192 (save 20%)
    </p>

    <p>Thank you for trying Freelanly PRO. We hope to continue helping you find your perfect remote job.</p>

    <p>Best,<br>The Freelanly Team</p>
  </div>
  <div class="footer">
    <p>You're receiving this because your PRO trial on <a href="https://freelanly.com">Freelanly</a> ends today.</p>
  </div>
</div>
</body>
</html>`,
      };

    default:
      throw new Error(`Unknown trial email type: ${emailType}`);
  }
}

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================

interface TrialSubscription {
  customerId: string;
  email: string;
  trialStart: Date;
  trialEnd: Date;
  trialDay: number; // 0-7
}

/**
 * Get all trialing subscriptions from Stripe
 */
async function getTrialingSubscriptions(): Promise<TrialSubscription[]> {
  const stripe = getStripe();

  const subscriptions = await stripe.subscriptions.list({
    status: 'trialing',
    limit: 100,
    expand: ['data.customer'],
  });

  const result: TrialSubscription[] = [];

  for (const sub of subscriptions.data) {
    if (!sub.trial_start || !sub.trial_end) continue;

    const customer = sub.customer as { id: string; email?: string | null };
    if (!customer?.email) continue;

    const trialStart = new Date(sub.trial_start * 1000);
    const trialEnd = new Date(sub.trial_end * 1000);
    const now = new Date();

    // Calculate trial day (0 = first day, 7 = last day)
    const msPerDay = 24 * 60 * 60 * 1000;
    const trialDay = Math.floor((now.getTime() - trialStart.getTime()) / msPerDay);

    result.push({
      customerId: customer.id,
      email: customer.email,
      trialStart,
      trialEnd,
      trialDay,
    });
  }

  return result;
}

/**
 * Get which email should be sent based on trial day
 */
function getEmailTypeForDay(trialDay: number): TrialEmailType | null {
  switch (trialDay) {
    case 0:
      return 'DAY_0_WELCOME';
    case 2:
      return 'DAY_2_FEATURES';
    case 5:
      return 'DAY_5_SOCIAL_PROOF';
    case 6:
      return 'DAY_6_URGENCY';
    case 7:
      return 'DAY_7_LAST_CHANCE';
    default:
      return null;
  }
}

/**
 * Check if email was already sent
 */
async function wasEmailSent(customerId: string, emailType: TrialEmailType): Promise<boolean> {
  const existing = await prisma.trialEmail.findUnique({
    where: {
      stripeCustomerId_emailType: {
        stripeCustomerId: customerId,
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
  customerId: string,
  email: string,
  emailType: TrialEmailType,
  trialStart: Date,
  trialEnd: Date
): Promise<void> {
  await prisma.trialEmail.create({
    data: {
      stripeCustomerId: customerId,
      email,
      emailType,
      trialStartDate: trialStart,
      trialEndDate: trialEnd,
    },
  });
}

/**
 * Send trial email to a subscriber
 */
async function sendTrialEmail(
  subscription: TrialSubscription,
  emailType: TrialEmailType
): Promise<boolean> {
  const content = getTrialEmailContent(emailType, {
    email: subscription.email,
    trialEndDate: subscription.trialEnd,
  });

  const result = await sendApplicationEmail({
    to: subscription.email,
    subject: content.subject,
    html: content.html,
  });

  return result.success;
}

/**
 * Main function: Process all trial emails
 * Should be called by cron every hour or so
 */
export async function processTrialEmails(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  details: Array<{ email: string; emailType: string; status: string }>;
}> {
  const stats = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    details: [] as Array<{ email: string; emailType: string; status: string }>,
  };

  try {
    const subscriptions = await getTrialingSubscriptions();
    console.log(`[TrialEmails] Found ${subscriptions.length} trialing subscriptions`);

    for (const sub of subscriptions) {
      stats.processed++;

      const emailType = getEmailTypeForDay(sub.trialDay);
      if (!emailType) {
        // Not a day we send emails
        continue;
      }

      // Check if already sent
      const alreadySent = await wasEmailSent(sub.customerId, emailType);
      if (alreadySent) {
        stats.skipped++;
        continue;
      }

      // Send email
      console.log(`[TrialEmails] Sending ${emailType} to ${sub.email}`);
      const success = await sendTrialEmail(sub, emailType);

      if (success) {
        await recordEmailSent(
          sub.customerId,
          sub.email,
          emailType,
          sub.trialStart,
          sub.trialEnd
        );
        stats.sent++;
        stats.details.push({ email: sub.email, emailType, status: 'sent' });
        console.log(`[TrialEmails] Sent ${emailType} to ${sub.email}`);
      } else {
        stats.failed++;
        stats.details.push({ email: sub.email, emailType, status: 'failed' });
        console.error(`[TrialEmails] Failed to send ${emailType} to ${sub.email}`);
      }
    }
  } catch (error) {
    console.error('[TrialEmails] Error processing trial emails:', error);
    throw error;
  }

  return stats;
}

/**
 * Get trial email statistics
 */
export async function getTrialEmailStats(): Promise<{
  totalSent: number;
  byType: Record<string, number>;
  last7Days: number;
}> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [totalSent, byType, last7Days] = await Promise.all([
    prisma.trialEmail.count(),
    prisma.trialEmail.groupBy({
      by: ['emailType'],
      _count: true,
    }),
    prisma.trialEmail.count({
      where: {
        sentAt: { gte: sevenDaysAgo },
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
    last7Days,
  };
}
