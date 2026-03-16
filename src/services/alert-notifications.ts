import { sendApplicationEmail } from '@/lib/email';
import { siteConfig } from '@/config/site';
import { prisma } from '@/lib/db';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || siteConfig.url;
// A/B variant limits per variant
const AB_LIMITS: Record<'A' | 'B' | 'C', number> = { A: 3, B: 2, C: 1 };

function getAlertAbVariant(seed: string): 'A' | 'B' | 'C' {
  const idx = parseInt(seed.slice(-2), 16) % 3;
  return (['A', 'B', 'C'] as const)[idx];
}

function addUtmParams(url: string, contentId: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}utm_source=job_alert&utm_medium=email&utm_content=${encodeURIComponent(contentId)}`;
}

function generateFreeUpsellBlock(hiddenCount: number): string {
  if (hiddenCount <= 0) return '';
  return `
        <tr>
          <td style="padding: 20px; text-align: center; background: linear-gradient(180deg, #fff 0%, #f0f9ff 100%);">
            <p style="font-size: 16px; font-weight: 600; color: #1e40af; margin: 0 0 8px;">
              +${hiddenCount} more — upgrade to see contacts & apply
            </p>
            <p style="color: #666; font-size: 14px; margin: 0 0 16px;">
              You found the projects. Get direct contacts to apply first.
            </p>
            <a href="https://freelanly.com/pricing?source=email_alert_upsell&utm_source=job_alert&utm_medium=email"
               style="display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Unlock Contact Details →
            </a>
          </td>
        </tr>`;
}

function truncateDescription(description: string, maxLength = 150): string {
  const text = description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').replace(/^About the Role\s*/i, '').trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

interface MatchedOpportunity {
  id: string;
  title: string;
  slug: string;
  description: string;
  clientName: string;
  clientAvatar: string | null;
  country: string | null;
  level: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: Date;
}

/**
 * Generate HTML for opportunity alert email
 */
function generateOpportunityAlertEmailHtml(
  opportunities: MatchedOpportunity[],
  alertCategory: string | null,
  unsubscribeUrl: string,
  hiddenCount = 0
): string {
  const categoryName = alertCategory
    ? alertCategory.charAt(0).toUpperCase() + alertCategory.slice(1)
    : 'All Categories';

  const opportunityCards = opportunities
    .map((opp) => {
      const oppUrl = addUtmParams(`${APP_URL}/freelance/${opp.slug}`, `opp_${opp.id}`);
      const salary = null; // salary removed from email

      return `
        <tr>
          <td style="padding: 20px; border-bottom: 1px solid #eee;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td>

                  <a href="${oppUrl}" style="color: #000; text-decoration: none; font-weight: 600; font-size: 16px;">
                    ${opp.title}
                  </a>
                  <div style="color: #666; font-size: 14px; margin-top: 4px;">
                    ${opp.country ? `${opp.country}` : ''}
                  </div>
                  ${opp.description ? `<div style="color: #555; font-size: 13px; margin-top: 6px; line-height: 1.4;">${truncateDescription(opp.description)}</div>` : ''}
                  ${salary ? `<div style="color: #22c55e; font-size: 14px; margin-top: 4px;">${salary}</div>` : ''}
                  <div style="margin-top: 10px;">
                    <a href="${oppUrl}" style="display: inline-block; background: #000; color: #fff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 14px;">
                      View Project
                    </a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px; text-align: center; border-bottom: 1px solid #eee;">
              <h1 style="margin: 0; font-size: 24px; color: #000;">
                🎯 New Freelance Projects for You
              </h1>
              <p style="margin: 10px 0 0; color: #666; font-size: 14px;">
                ${opportunities.length} new ${categoryName} project${opportunities.length > 1 ? 's' : ''} matching your alert
              </p>
            </td>
          </tr>

          <!-- Opportunity Cards -->
          ${opportunityCards}

          ${generateFreeUpsellBlock(hiddenCount)}

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background: #f9fafb; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0; color: #666; font-size: 12px;">
                You're receiving this because you set up a job alert on Freelanly.
              </p>
              <p style="margin: 10px 0 0;">
                <a href="${unsubscribeUrl}" style="color: #666; font-size: 12px;">
                  Unsubscribe from this alert
                </a>
                &nbsp;•&nbsp;
                <a href="${APP_URL}/dashboard/alerts" style="color: #666; font-size: 12px;">
                  Manage alerts
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of opportunity email
 */
function generateOpportunityAlertEmailText(
  opportunities: MatchedOpportunity[],
  alertCategory: string | null
): string {
  const categoryName = alertCategory || 'All Categories';
  const header = `🎯 New Freelance Projects for You\n${opportunities.length} new ${categoryName} projects matching your alert\n\n`;

  const oppList = opportunities
    .map((opp) => {
      const oppUrl = addUtmParams(`${APP_URL}/freelance/${opp.slug}`, `opp_${opp.id}`);
      const salary =
        false ? '' : '';
      const desc = opp.description ? truncateDescription(opp.description) : '';
      return `${opp.title}\n${opp.country ? `${opp.country}` : ''}${desc ? `\n${desc}` : ''}\n${oppUrl}\n`;
    })
    .join('\n');

  const footer = `\n---\nManage your alerts: ${APP_URL}/dashboard/alerts`;

  return header + oppList + footer;
}

/**
 * Send email notification for opportunities
 */
async function sendOpportunityAlertNotification(params: {
  alertId: string;
  email: string;
  userPlan?: string;
  category: string | null;
  opportunities: MatchedOpportunity[];
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const { alertId, email, userPlan, category, opportunities } = params;

  if (opportunities.length === 0) {
    return { success: true };
  }

  // Basic email validation — skip obviously invalid addresses
  if (!email.includes('@') || !/\.[a-z]{2,}$/i.test(email)) {
    console.warn(`[AlertNotifications] Skipping invalid email: ${email}`);
    return { success: true }; // Don't count as failure to avoid noise
  }

  // A/B variant: stable per email
  const abVariant = getAlertAbVariant(email);
  const freeLimit = AB_LIMITS[abVariant];

  // Limit items for FREE users
  const isFreeLimited = userPlan === 'FREE' && opportunities.length > freeLimit;
  const hiddenCount = isFreeLimited ? opportunities.length - freeLimit : 0;
  const visibleOpps = isFreeLimited ? opportunities.slice(0, freeLimit) : opportunities;

  const unsubscribeUrl = `${APP_URL}/api/user/alerts/${alertId}/unsubscribe?utm_variant=${abVariant}`;

  // Subject line per A/B variant
  let subject: string;
  if (abVariant === 'C' && opportunities.length >= 1) {
    subject = `${opportunities[0].title} — client contact inside`;
  } else if (abVariant === 'B') {
    subject = `${opportunities.length} freelance project${opportunities.length > 1 ? 's' : ''} matched you — apply before others`;
  } else {
    subject = opportunities.length === 1
      ? `🎯 ${opportunities[0].title} — Freelance Project`
      : `🎯 ${opportunities.length} new freelance projects for you`;
  }

  const html = generateOpportunityAlertEmailHtml(visibleOpps, category, unsubscribeUrl, hiddenCount);
  const text = generateOpportunityAlertEmailText(visibleOpps, category);

  try {
    const result = await sendApplicationEmail({
      to: email,
      subject,
      html,
      text,
    });

    if (result.success) {
      console.log(`[AlertNotifications] Sent ${opportunities.length} opportunities to ${email}`);
      return { success: true, messageId: result.messageId };
    } else {
      const errorMsg = typeof result.error === 'object' ? JSON.stringify(result.error) : result.error;
      console.error(`[AlertNotifications] Failed to send opportunities to ${email}: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error(`[AlertNotifications] Error sending opportunities to ${email}:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if an opportunity matches an alert's criteria
 */
function checkOpportunityMatchesAlert(
  opp: {
    category: { slug: string };
    country: string | null;
    level: string;
    title: string;
    description: string;
    translationTypes: string[];
    sourceLanguages: string[];
    targetLanguages: string[];
  },
  alert: {
    category: string | null;
    keywords: string | null;
    country: string | null;
    level: string | null;
    languagePairs: Array<{
      translationType: string;
      sourceLanguage: string;
      targetLanguage: string;
    }>;
  }
): boolean {
  // Skip alerts with ALL null filters - too broad, would match ALL opportunities
  const hasAnyFilter = !!(
    alert.category ||
    alert.keywords ||
    alert.country ||
    alert.level ||
    alert.languagePairs.length > 0
  );
  if (!hasAnyFilter) {
    return false;
  }

  // Category filter
  if (alert.category && opp.category.slug !== alert.category) {
    return false;
  }

  // Country filter
  if (alert.country && opp.country !== alert.country) {
    return false;
  }

  // Level filter
  if (alert.level && opp.level !== alert.level) {
    return false;
  }

  // Keywords filter
  if (alert.keywords) {
    const keywordList = alert.keywords
      .toLowerCase()
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k);

    const searchText = `${opp.title} ${opp.description}`.toLowerCase();
    const hasKeyword = keywordList.some((keyword) => searchText.includes(keyword));

    if (!hasKeyword) {
      return false;
    }
  }

  // Language filtering for ALL opportunities (not just translation)
  // Extract user's languages from alert pairs (excluding EN)
  const userLanguages = new Set<string>();
  if (alert.languagePairs.length > 0) {
    for (const pair of alert.languagePairs) {
      if (pair.sourceLanguage !== 'EN') userLanguages.add(pair.sourceLanguage);
      if (pair.targetLanguage !== 'EN') userLanguages.add(pair.targetLanguage);
    }
  }

  // Collect non-EN languages from the opportunity
  const oppNonEnLanguages = new Set<string>();
  for (const lang of opp.sourceLanguages) {
    if (lang !== 'EN') oppNonEnLanguages.add(lang);
  }
  for (const lang of opp.targetLanguages) {
    if (lang !== 'EN') oppNonEnLanguages.add(lang);
  }

  // UNIVERSAL LANGUAGE CHECK:
  // If opportunity requires specific non-EN languages but user has NO language preferences,
  // DON'T send. Prevents Arabic writing projects going to non-Arabic speakers.
  if (oppNonEnLanguages.size > 0 && userLanguages.size === 0) {
    return false;
  }

  // For non-translation opportunities with no specific languages, send to everyone
  if (opp.category.slug !== 'translation') {
    // If user specified language pairs, they only want translation opportunities
    if (alert.languagePairs.length > 0) {
      return false;
    }
    // Opportunity has no specific languages OR user has matching languages
    if (oppNonEnLanguages.size === 0) {
      return true;
    }
    // Opportunity has specific languages - check if user has ANY of them
    return Array.from(oppNonEnLanguages).some((lang) => userLanguages.has(lang));
  }

  // Translation opportunity - apply stricter language matching

  // If opportunity has no specific languages, it's a general translation opportunity
  // Only send to users WITHOUT specific language pairs (users with pairs want exact matches)
  if (oppNonEnLanguages.size === 0) {
    return userLanguages.size === 0;
  }

  // Both opportunity and user have specific languages - match them
  const hasNonEnSource = opp.sourceLanguages.some((l) => l !== 'EN');

  if (hasNonEnSource) {
    // Specific language pair (e.g., FR->ES) — user must know ALL non-EN languages
    return Array.from(oppNonEnLanguages).every((lang) =>
      userLanguages.has(lang)
    );
  } else {
    // Multilingual (src=[EN], tgt=[many]) — user needs ANY of the target languages
    return Array.from(oppNonEnLanguages).some((lang) =>
      userLanguages.has(lang)
    );
  }
}

// Minimum time between alert emails for the same user (prevents spam)
const MIN_ALERT_INTERVAL_MINUTES = 30;

// Settings key for tracking last cron run
const LAST_CRON_RUN_KEY = 'lastAlertCronRun';

// Default lookback when no previous cron run recorded
const DEFAULT_LOOKBACK_HOURS = 2;

/**
 * Process INSTANT alerts — opportunity-first model.
 *
 * Instead of iterating all users and querying opportunities per user,
 * this flips the approach:
 * 1. Find new Opportunities since last cron run (1-5 per run)
 * 2. For each opportunity: find all matching INSTANT alerts
 * 3. Group matches by user email
 * 4. Send ONE email per user with all their matched opportunities
 * 5. Update lastSentAt on affected alerts
 */
export async function processInstantAlertQueue(): Promise<{
  sent: number;
  failed: number;
  processed: number;
  skippedDebounce: number;
  newOpportunities: number;
}> {
  // Step 1: Get last cron run timestamp
  const lastRunSetting = await prisma.settings.findUnique({
    where: { key: LAST_CRON_RUN_KEY },
  });
  const lastRun = lastRunSetting
    ? new Date(lastRunSetting.value as string)
    : new Date(Date.now() - DEFAULT_LOOKBACK_HOURS * 60 * 60 * 1000);
  const now = new Date();

  // Step 2: Find new opportunities since last run
  const newOpportunities = await prisma.opportunity.findMany({
    where: {
      isActive: true,
      postedAt: { gte: lastRun },
    },
    include: {
      category: { select: { slug: true } },
    },
    orderBy: { postedAt: 'desc' },
  });

  // Save current timestamp immediately (even if no opportunities — prevents re-scanning)
  await prisma.settings.upsert({
    where: { key: LAST_CRON_RUN_KEY },
    create: { key: LAST_CRON_RUN_KEY, value: now.toISOString() },
    update: { value: now.toISOString() },
  });

  if (newOpportunities.length === 0) {
    console.log(`[InstantAlerts] No new opportunities since ${lastRun.toISOString()}`);
    return { sent: 0, failed: 0, processed: 0, skippedDebounce: 0, newOpportunities: 0 };
  }

  console.log(`[InstantAlerts] Found ${newOpportunities.length} new opportunities since ${lastRun.toISOString()}`);

  // Step 3: Load all active INSTANT alerts (once, for matching against all opportunities)
  const instantAlerts = await prisma.jobAlert.findMany({
    where: {
      isActive: true,
      frequency: 'INSTANT',
      OR: [
        {
          user: {
            emailVerified: { not: null },
            unsubscribedFromMarketing: false,
          },
        },
        { userId: null },
      ],
    },
    include: {
      languagePairs: true,
      user: {
        select: { email: true, plan: true },
      },
    },
  });

  if (instantAlerts.length === 0) {
    console.log('[InstantAlerts] No active INSTANT alerts');
    return { sent: 0, failed: 0, processed: 0, skippedDebounce: 0, newOpportunities: newOpportunities.length };
  }

  // Step 4: For each opportunity, find matching alerts → group by email
  // Map: email → { alerts, matched opportunities }
  const matchesByEmail = new Map<string, {
    alerts: typeof instantAlerts;
    opportunities: Map<string, MatchedOpportunity>;
  }>();

  for (const opp of newOpportunities) {
    const oppData = {
      category: opp.category,
      country: opp.country,
      level: opp.level,
      title: opp.title,
      description: opp.description,
      translationTypes: opp.translationTypes as string[],
      sourceLanguages: opp.sourceLanguages,
      targetLanguages: opp.targetLanguages,
    };

    const matchedOpp: MatchedOpportunity = {
      id: opp.id,
      title: opp.title,
      slug: opp.slug,
      description: opp.description,
      clientName: opp.clientName,
      clientAvatar: opp.clientAvatar,
      country: opp.country,
      level: opp.level,
      salaryMin: opp.salaryMin,
      salaryMax: opp.salaryMax,
      salaryCurrency: opp.salaryCurrency,
      postedAt: opp.postedAt,
    };

    for (const alert of instantAlerts) {
      const matches = checkOpportunityMatchesAlert(oppData, {
        category: alert.category,
        keywords: alert.keywords,
        country: alert.country,
        level: alert.level,
        languagePairs: alert.languagePairs.map((lp) => ({
          translationType: lp.translationType,
          sourceLanguage: lp.sourceLanguage,
          targetLanguage: lp.targetLanguage,
        })),
      });

      if (!matches) continue;

      const email = (alert.email || alert.user?.email)?.toLowerCase();
      if (!email) continue;

      let entry = matchesByEmail.get(email);
      if (!entry) {
        entry = { alerts: [], opportunities: new Map() };
        matchesByEmail.set(email, entry);
      }
      // Collect unique alerts for this user (avoid duplicates)
      if (!entry.alerts.some((a) => a.id === alert.id)) {
        entry.alerts.push(alert);
      }
      entry.opportunities.set(opp.id, matchedOpp);
    }
  }

  if (matchesByEmail.size === 0) {
    console.log(`[InstantAlerts] No matches found for ${newOpportunities.length} opportunities against ${instantAlerts.length} alerts`);
    return { sent: 0, failed: 0, processed: 0, skippedDebounce: 0, newOpportunities: newOpportunities.length };
  }

  console.log(`[InstantAlerts] ${matchesByEmail.size} users matched`);

  // Step 5: Send emails, respecting debounce
  const debounceThreshold = new Date(Date.now() - MIN_ALERT_INTERVAL_MINUTES * 60 * 1000);
  let sent = 0;
  let failed = 0;
  let processed = 0;
  let skippedDebounce = 0;

  for (const [email, { alerts, opportunities }] of matchesByEmail) {
    // Debounce check
    const mostRecentSent = alerts.reduce((latest, a) => {
      if (!a.lastSentAt) return latest;
      if (!latest) return a.lastSentAt;
      return a.lastSentAt > latest ? a.lastSentAt : latest;
    }, null as Date | null);

    if (mostRecentSent && mostRecentSent > debounceThreshold) {
      skippedDebounce++;
      continue;
    }

    processed += opportunities.size;
    const userPlan = alerts[0].user?.plan || 'FREE';
    const primaryCategory = alerts.find((a) => a.category)?.category || null;

    const result = await sendOpportunityAlertNotification({
      alertId: alerts[0].id,
      email,
      userPlan,
      category: primaryCategory,
      opportunities: Array.from(opportunities.values()),
    });

    if (result.success) {
      sent++;
      const alertIds = alerts.map((a) => a.id);
      await prisma.jobAlert.updateMany({
        where: { id: { in: alertIds } },
        data: {
          lastSentAt: new Date(),
          emailsSent: { increment: 1 },
        },
      });
    } else {
      failed++;
      console.error(`[InstantAlerts] Failed to send to ${email}: ${result.error}`);
    }

    // Rate limit: 200ms between emails
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`[InstantAlerts] Done: ${sent} sent, ${failed} failed, ${processed} opps, ${skippedDebounce} debounced, ${newOpportunities.length} new opps`);

  return { sent, failed, processed, skippedDebounce, newOpportunities: newOpportunities.length };
}
