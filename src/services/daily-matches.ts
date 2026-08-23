/**
 * Recurring daily "new matched roles" digest.
 *
 * The recurring sibling of day1-matches.ts (which is a one-shot ~24h after signup). This runs every
 * day: for each opted-in user, at ~09:00 their LOCAL time, it fit-scores the opportunities that
 * appeared since their last digest and, if there are enough, sends one email with the top matches.
 *
 * Design choices that matter:
 *  - DEDUPE by timestamp, not by a sent-log. Only opportunities created after User.lastDailyDigestAt
 *    (capped at LOOKBACK_MAX_H so a dormant user doesn't get a multi-day pile) are considered, and
 *    the marker is stamped to now() ONLY on a successful send. An opportunity is created once, in one
 *    window, so it reaches a user at most once. No AlertNotification rows, no per-pair bookkeeping.
 *  - NO THIN EMAILS, and matches ACCUMULATE. Below MIN_MATCHES we do NOT stamp — the same window is
 *    reconsidered tomorrow, so a slow-matching profile builds up to the threshold instead of leaking
 *    its matches into un-sent days. (day1 stamps on skip because its window is one morning; here the
 *    window rolls forward every day.)
 *  - HOURLY-DRIVEN, self-selecting on local time. The cron fires hourly; a user is processed only
 *    when their local clock is inside the send window AND they have not been sent in ~20h. That gate
 *    plus the stamp prevents doubles without a per-day marker.
 *
 * Job alerts (JobAlert/AlertNotification, INSTANT/DAILY/WEEKLY) remain suspended; this is the single
 * recurring outbound the product sends besides recap and auto-apply mail.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { sendApplicationEmail } from '@/lib/email';
import { day1MatchesEmail } from '@/lib/email-templates';
import { sendTelegramNotification, formatDay1MatchesTG } from '@/lib/telegram-notify';
import { getUnsubscribeUrl, getUnsubscribeFooterHtml } from '@/lib/unsubscribe';
import { buildFitContext, scoreFitLabeled } from '@/lib/fit-score';
import { verifiedSkillsFor, type ReviewRow } from '@/lib/github-review/evidence';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://freelanly.com';
const TARGET_HOUR = 9;          // user-local send hour
const SEND_WINDOW_HOURS = 3;    // 09:00–11:59 — retry room for a failed hourly run
const RESEND_GAP_H = 20;        // never send twice inside this many hours (double-guard with the window)
const LOOKBACK_MAX_H = 72;      // cap on how far back a never-sent / dormant user reaches
const MIN_MATCHES = 3;          // honesty guard: below this, no email (and no stamp — accumulate)
const TOP_EMAIL = 5;
const TOP_TG = 3;
const THROTTLE_MS = 200;
const FALLBACK_OFFSET_H = -5;   // no/broken tz → UTC-5 (LATAM morning); UTC would deliver at 3am local

function getUtcOffsetForTimezone(tz: string): number {
  try {
    const now = new Date();
    const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    return Math.round((local.getTime() - utc.getTime()) / 3600000);
  } catch {
    return FALLBACK_OFFSET_H;
  }
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600e3);

type DailyStats = {
  checked: number; sent: number; tgSent: number;
  skippedThin: number; wrongHour: number; recentlySent: number; failed: number;
  wouldSend?: Array<{ email: string; n: number; localHour: number; top: string[] }>;
};

export async function processDailyMatches(opts: {
  force?: boolean;      // bypass the local-hour + recent-send gates (dry runs / backfills)
  dryRun?: boolean;     // compute + report; no sends, no stamps
  testEmail?: string;   // single-user smoke test: bypasses all gates and the marker, NEVER stamps
} = {}): Promise<DailyStats> {
  const { force = false, dryRun = false, testEmail } = opts;
  const stats: DailyStats = { checked: 0, sent: 0, tgSent: 0, skippedThin: 0, wrongHour: 0, recentlySent: 0, failed: 0 };
  if (dryRun) stats.wouldSend = [];

  const userSelect = {
    id: true, email: true, name: true, timezone: true, telegramChatId: true,
    parsedProfile: true, githubUrl: true, lastDailyDigestAt: true,
    githubReview: { select: { verdict: true, report: true, profileStamp: true, reviewedAt: true } },
  } as const;

  const users = testEmail
    ? await prisma.user.findMany({ where: { email: testEmail, unsubscribedFromMarketing: false }, select: userSelect })
    : await prisma.user.findMany({
        where: {
          // Watcher-product accounts must never receive Freelanly-branded mail.
          NOT: { source: { startsWith: 'watcher:' } },
          emailVerified: { not: null },
          unsubscribedFromMarketing: false,
          emailBounceCount: { lt: 3 },
          notifyDigest: true,
          parsedProfile: { not: Prisma.DbNull },
          resumeUrl: { not: null },
          // Not sent in the last ~20h. (null = never sent → always eligible.)
          OR: [{ lastDailyDigestAt: null }, { lastDailyDigestAt: { lt: hoursAgo(RESEND_GAP_H) } }],
        },
        select: userSelect,
      });
  if (!users.length) return stats;

  // The freshest slice of the feed once per run; each user filters it to "since my last digest".
  const pool = await prisma.opportunity.findMany({
    where: {
      isActive: true,
      createdAt: { gte: hoursAgo(LOOKBACK_MAX_H) },
      OR: [{ applyEmail: { not: null } }, { applyUrl: { not: null } }],
    },
    select: { id: true, title: true, skills: true, createdAt: true },
  });

  const utcHour = new Date().getUTCHours();

  for (const user of users) {
    stats.checked++;

    if (!force && !testEmail) {
      const offset = user.timezone ? getUtcOffsetForTimezone(user.timezone) : FALLBACK_OFFSET_H;
      const localHour = ((utcHour + offset) % 24 + 24) % 24;
      if (localHour < TARGET_HOUR || localHour >= TARGET_HOUR + SEND_WINDOW_HOURS) { stats.wrongHour++; continue; }
    }

    try {
      // "New since your last digest", capped so a long-dormant user can't pull 72h+ of backlog.
      const sinceMs = user.lastDailyDigestAt
        ? Math.max(user.lastDailyDigestAt.getTime(), hoursAgo(LOOKBACK_MAX_H).getTime())
        : hoursAgo(LOOKBACK_MAX_H).getTime();

      const pp = user.parsedProfile as Record<string, unknown>;
      const ghUser = { githubUrl: user.githubUrl, parsedProfile: user.parsedProfile };
      const ghReview = (user.githubReview as ReviewRow | null) ?? null;
      const ctx = buildFitContext(pp, verifiedSkillsFor(ghUser, ghReview));
      // Thin profile: no basis to match. Do NOT stamp — nothing was sent, reconsider tomorrow.
      if (ctx.empty) { stats.skippedThin++; continue; }

      const matched = pool
        .filter(o => o.createdAt.getTime() > sinceMs)
        .map(o => ({ o, f: scoreFitLabeled(ctx, { title: o.title, skills: o.skills }) }))
        .filter(x => x.f.label !== 'Weak')
        .sort((a, b) =>
          ((a.f.label === 'Strong' ? 0 : 1) - (b.f.label === 'Strong' ? 0 : 1)) ||
          (b.f.score - a.f.score) ||
          (b.o.createdAt.getTime() - a.o.createdAt.getTime()));
      const n = matched.length;

      // Below the bar → no email, no stamp. Matches carry forward to accumulate.
      if (n < MIN_MATCHES) { stats.skippedThin++; continue; }

      const topIds = matched.slice(0, TOP_EMAIL).map(x => x.o.id);
      const tops = await prisma.opportunity.findMany({
        where: { id: { in: topIds } },
        select: { id: true, title: true, slug: true, clientName: true, posterCompany: true, location: true, company: { select: { name: true } } },
      });
      const byId = new Map(tops.map(t => [t.id, t]));
      const fitById = new Map(matched.map(x => [x.o.id, x.f]));
      const roles = topIds.map(id => {
        const t = byId.get(id);
        if (!t) return null;
        return {
          id: t.id,
          title: t.title,
          company: t.company?.name || t.posterCompany || t.clientName || 'Company',
          location: t.location,
          matchedSkills: (fitById.get(id)?.matchedSkills || []).slice(0, 4),
          url: `${APP_URL}/dashboard/discovery?apply=${t.id}&utm_source=daily_matches&utm_medium=email&utm_content=opp_${t.id}`,
        };
      }).filter(Boolean) as Array<{ id: string; title: string; company: string; location: string | null; matchedSkills: string[]; url: string }>;
      if (roles.length < MIN_MATCHES) { stats.skippedThin++; continue; }

      const firstName = (user.name || (pp.name as string) || '').trim().split(/\s+/)[0] || null;
      const feedUrl = `${APP_URL}/dashboard/discovery?utm_source=daily_matches&utm_medium=email&utm_content=see_all`;

      if (dryRun) {
        stats.wouldSend!.push({
          email: user.email,
          n,
          localHour: ((utcHour + (user.timezone ? getUtcOffsetForTimezone(user.timezone) : FALLBACK_OFFSET_H)) % 24 + 24) % 24,
          top: roles.map(r => r.title),
        });
        continue;
      }

      const tpl = day1MatchesEmail({
        firstName, totalMatches: n, roles, feedUrl,
        unsubscribeFooterHtml: getUnsubscribeFooterHtml(user.email),
      });
      const res = await sendApplicationEmail({
        to: user.email, subject: tpl.subject, html: tpl.html, text: tpl.text,
        emailType: 'daily_matches', userId: user.id,
        listUnsubscribe: getUnsubscribeUrl(user.email),
      });
      if (!res.success) {
        // No stamp → retried on the next hourly run inside the window.
        console.error(`[DailyMatches] email failed for ${user.email}: ${res.error}`);
        stats.failed++;
        continue;
      }
      stats.sent++;
      await stampSent(user.id, testEmail);

      if (user.telegramChatId) {
        const tg = formatDay1MatchesTG({
          totalMatches: n,
          roles: roles.slice(0, TOP_TG).map(r => ({
            title: r.title, company: r.company,
            url: r.url.replace('utm_medium=email', 'utm_medium=telegram'),
          })),
          feedUrl: feedUrl.replace('utm_medium=email', 'utm_medium=telegram'),
        });
        const ok = await sendTelegramNotification(user.telegramChatId, tg.text, tg.markup);
        if (ok) stats.tgSent++;
      }
    } catch (e) {
      console.error(`[DailyMatches] user ${user.email} failed:`, e instanceof Error ? e.message : e);
      stats.failed++;
    }

    await new Promise(r => setTimeout(r, THROTTLE_MS));
  }

  console.log(`[DailyMatches] checked=${stats.checked} sent=${stats.sent} tg=${stats.tgSent} thin=${stats.skippedThin} wrongHour=${stats.wrongHour} failed=${stats.failed}${dryRun ? ' (dry run)' : ''}`);
  return stats;
}

/** Stamp the last-sent marker. Never stamps in testEmail mode. */
async function stampSent(userId: string, testEmail?: string): Promise<void> {
  if (testEmail) return;
  await prisma.user.update({ where: { id: userId }, data: { lastDailyDigestAt: new Date() } });
}
