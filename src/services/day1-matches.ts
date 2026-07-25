/**
 * Day+1 "your new matched roles" one-shot (owner decision 2026-07-17).
 *
 * WHY: only 7.7% of registrants ever return, and returns are what convert (warm users pay at ~17%
 * at the wall vs ~3% cold). The honest hook: the median profile gets ~35 Good+ new matches per day
 * (measured 2026-07-17 on 30 users × 774 opps). One email ~24h after registration, at ~09:00 the
 * user's LOCAL time, with 3–5 real fit-scored match cards + a Telegram duplicate for linked users.
 *
 * ONE-SHOT, not a digest: dedupe marker User.day1DigestSentAt (stamped on send OR on honest skip —
 * "evaluated"). Job alerts remain suspended; this is a separate targeted email.
 *
 * Cadence: hourly cron (Hetzner, like the other email drips) hits /api/cron/send-day1-matches;
 * this service self-selects users whose local clock is inside 09:00–11:59 (3h window so a failed
 * 09:00 run retries at 10/11; the marker prevents doubles).
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
const COHORT_MIN_H = 20;        // eligibility window: registered 20–48h ago
const COHORT_MAX_H = 48;
const MATCH_WINDOW_H = 48;      // opportunities considered "new since you signed up"
const MIN_MATCHES = 3;          // honesty guard: below this, no email (bottom-15% thin profiles)
const TOP_EMAIL = 5;
const TOP_TG = 3;
const THROTTLE_MS = 200;

// Copied from send-daily-recap (route-private there): IANA tz → current UTC offset in hours.
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
// No/broken timezone → UTC-5: the base skews LATAM (Bogotá/Lima/EST morning). A UTC fallback
// would deliver at 03–04:00 local for most of the cohort — inbox death.
const FALLBACK_OFFSET_H = -5;

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600e3);

type Day1Stats = {
  checked: number; sent: number; tgSent: number;
  skippedThin: number; wrongHour: number; failed: number;
  wouldSend?: Array<{ email: string; n: number; localHour: number; top: string[] }>;
};

export async function processDay1Matches(opts: {
  force?: boolean;      // bypass the local-hour gate (dry runs / backfills)
  dryRun?: boolean;     // compute + report; no sends, no stamps
  testEmail?: string;   // single-user smoke test: bypasses window/marker/hour, NEVER stamps
} = {}): Promise<Day1Stats> {
  const { force = false, dryRun = false, testEmail } = opts;
  const stats: Day1Stats = { checked: 0, sent: 0, tgSent: 0, skippedThin: 0, wrongHour: 0, failed: 0 };
  if (dryRun) stats.wouldSend = [];

  const userSelect = {
    id: true, email: true, name: true, timezone: true, telegramChatId: true,
    parsedProfile: true, githubUrl: true,
    githubReview: { select: { verdict: true, report: true, profileStamp: true, reviewedAt: true } },
  } as const;

  const users = testEmail
    ? await prisma.user.findMany({ where: { email: testEmail, unsubscribedFromMarketing: false }, select: userSelect })
    : await prisma.user.findMany({
        where: {
          createdAt: { gte: hoursAgo(COHORT_MAX_H), lte: hoursAgo(COHORT_MIN_H) },
          day1DigestSentAt: null,
          // Watcher-product accounts must never receive Freelanly-branded mail.
          NOT: { source: { startsWith: 'watcher:' } },
          emailVerified: { not: null },
          unsubscribedFromMarketing: false,
          emailBounceCount: { lt: 3 },
          notifyDigest: true,
          parsedProfile: { not: Prisma.DbNull },
          resumeUrl: { not: null },
        },
        select: userSelect,
      });
  if (!users.length) return stats;

  // One shared pool per run (discovery-feed pattern: light rows, score in memory — no LLM).
  const pool = await prisma.opportunity.findMany({
    where: {
      isActive: true,
      createdAt: { gte: hoursAgo(MATCH_WINDOW_H) },
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
      const pp = user.parsedProfile as Record<string, unknown>;
      const ghUser = { githubUrl: user.githubUrl, parsedProfile: user.parsedProfile };
      const ghReview = (user.githubReview as ReviewRow | null) ?? null;
      const ctx = buildFitContext(pp, verifiedSkillsFor(ghUser, ghReview));
      if (ctx.empty) { await stampEvaluated(user.id, dryRun, testEmail); stats.skippedThin++; continue; }

      const matched = pool
        .map(o => ({ o, f: scoreFitLabeled(ctx, { title: o.title, skills: o.skills }) }))
        .filter(x => x.f.label !== 'Weak')
        .sort((a, b) =>
          ((a.f.label === 'Strong' ? 0 : 1) - (b.f.label === 'Strong' ? 0 : 1)) ||
          (b.f.score - a.f.score) ||
          (b.o.createdAt.getTime() - a.o.createdAt.getTime()));
      const n = matched.length;

      if (n < MIN_MATCHES) {
        // Honest skip — no thin emails. Stamp as evaluated: their one local-morning inside the
        // window has passed; re-checking tomorrow buys ~1 extra match at best.
        await stampEvaluated(user.id, dryRun, testEmail);
        stats.skippedThin++;
        continue;
      }

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
          // Into the ACCOUNT, not the public page (owner call 2026-07-17): the feed with this
          // project auto-opened in the apply modal (arrival flow). Day-1 recipients registered
          // yesterday — the 30-day session is almost always alive on the device that opens the
          // email; a logged-out click goes through signin and lands in the same feed+modal.
          url: `${APP_URL}/dashboard/discovery?apply=${t.id}&utm_source=day1_matches&utm_medium=email&utm_content=opp_${t.id}`,
        };
      }).filter(Boolean) as Array<{ id: string; title: string; company: string; location: string | null; matchedSkills: string[]; url: string }>;
      if (roles.length < MIN_MATCHES) { await stampEvaluated(user.id, dryRun, testEmail); stats.skippedThin++; continue; }

      const firstName = (user.name || (pp.name as string) || '').trim().split(/\s+/)[0] || null;
      const feedUrl = `${APP_URL}/dashboard/discovery?utm_source=day1_matches&utm_medium=email&utm_content=see_all`;

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
        emailType: 'day1_matches', userId: user.id,
        listUnsubscribe: getUnsubscribeUrl(user.email),
      });
      if (!res.success) {
        // No stamp → the 3h local window (and the 20–48h cohort window) retries automatically.
        console.error(`[Day1Matches] email failed for ${user.email}: ${res.error}`);
        stats.failed++;
        continue;
      }
      stats.sent++;

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

      await stampEvaluated(user.id, false, testEmail);
    } catch (e) {
      console.error(`[Day1Matches] user ${user.email} failed:`, e instanceof Error ? e.message : e);
      stats.failed++;
    }

    await new Promise(r => setTimeout(r, THROTTLE_MS));
  }

  console.log(`[Day1Matches] checked=${stats.checked} sent=${stats.sent} tg=${stats.tgSent} thin=${stats.skippedThin} wrongHour=${stats.wrongHour} failed=${stats.failed}${dryRun ? ' (dry run)' : ''}`);
  return stats;
}

/** CAS stamp — race-safe against an overlapping run; never stamps in dryRun/testEmail mode. */
async function stampEvaluated(userId: string, dryRun: boolean, testEmail?: string): Promise<void> {
  if (dryRun || testEmail) return;
  await prisma.user.updateMany({
    where: { id: userId, day1DigestSentAt: null },
    data: { day1DigestSentAt: new Date() },
  });
}
