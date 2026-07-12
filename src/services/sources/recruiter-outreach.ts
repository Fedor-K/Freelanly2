// Block 4 — send the candidate shortlist to a company (the demand-side outreach).
//
// This is COLD outreach to companies that never opted in, so it is dangerous by default: it can
// burn the sending domain's reputation and, if it shared infra with OTP/auto-apply, take those
// down too. Every limit below is therefore HARD-ENFORCED in code, not advisory.
//
// SENDING TACTIC (enforced here):
//   • Per company: 1 card + at most 1 follow-up (after FOLLOWUP_AFTER_DAYS), then silence for
//     COOLDOWN_DAYS. Never repeatedly hit a generic careers@ inbox.
//   • Daily volume: starts tiny (DAILY_CAP, default 20) and is ramped by RAISING the env cap by
//     hand as warm-up proceeds (~30-50 wk1 → ~100-150 if metrics stay green). The cap is a hard
//     ceiling — the sender physically cannot exceed it.
//   • Kill-switch gates: if recent bounce-rate > MAX_BOUNCE or complaint-rate > MAX_COMPLAINT
//     (measured from RecruiterSuppression vs COMPANY_CARD_SENT), ALL sending stops until fixed.
//   • Suppression: never email an opted-out / bounced / complained address.
//   • Master switch OUTREACH_ENABLED defaults to FALSE — nothing sends until explicitly turned on,
//     and only on isolated infra (separate OUTREACH_FROM_EMAIL domain, NOT the Postal txn domain).
//   • Escalation to a named decision-maker is by ENGAGEMENT (open/click), handled elsewhere — this
//     module only does the cheap generic-inbox first touch.
//
// ⚠️ Run on the Hetzner worker (port 25 / Postal). Not wired to any cron yet — dormant by default.
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { sendEmail } from '@/lib/email';
import { getRecruiterPortalUrl, getRecruiterUnsubscribeUrl } from '@/lib/recruiter-token';
import type { LeverCompanyCard } from './lever-pipeline';
import type { ShortlistCandidate } from '@/services/recruiter-shortlist';

const bool = (v: string | undefined, d: boolean) => (v === undefined ? d : v === 'true');
const int = (v: string | undefined, d: number) => { const n = parseInt(v || ''); return Number.isFinite(n) ? n : d; };
const num = (v: string | undefined, d: number) => { const n = parseFloat(v || ''); return Number.isFinite(n) ? n : d; };

/** All knobs env-overridable so warm-up/ramp needs no redeploy. Cap is a HARD ceiling. */
export const OUTREACH = {
  enabled: bool(process.env.OUTREACH_ENABLED, false),          // master switch — OFF by default
  fromEmail: process.env.OUTREACH_FROM_EMAIL || process.env.POSTAL_FROM_EMAIL || 'info@freelanly.com',
  dailyCap: int(process.env.OUTREACH_DAILY_CAP, 20),           // raise by hand as warm-up proceeds
  cooldownDays: int(process.env.OUTREACH_COOLDOWN_DAYS, 14),
  followUpAfterDays: int(process.env.OUTREACH_FOLLOWUP_AFTER_DAYS, 6),
  maxFollowUps: int(process.env.OUTREACH_MAX_FOLLOWUPS, 1),    // initial + this many follow-ups
  maxBounceRate: num(process.env.OUTREACH_MAX_BOUNCE, 0.03),   // 3%
  maxComplaintRate: num(process.env.OUTREACH_MAX_COMPLAINT, 0.001), // 0.1%
  healthSampleMin: int(process.env.OUTREACH_HEALTH_SAMPLE_MIN, 50), // gates need ≥N recent sends
  healthWindowDays: int(process.env.OUTREACH_HEALTH_WINDOW_DAYS, 7),
};

type Gate = { ok: boolean; reason?: string };

async function countSent(sinceMs: number, where: object = {}): Promise<number> {
  try {
    return await prisma.activityLog.count({
      where: { action: 'COMPANY_CARD_SENT', createdAt: { gte: new Date(Date.now() - sinceMs) }, ...where },
    });
  } catch { return 0; }
}

/** Kill-switch: stop everything if recent deliverability is bad. Fail-OPEN only while warming. */
export async function outreachHealth(): Promise<Gate> {
  const windowMs = OUTREACH.healthWindowDays * 864e5;
  const sent = await countSent(windowMs, { details: { path: ['ok'], equals: true } });
  if (sent < OUTREACH.healthSampleMin) return { ok: true, reason: `warming (${sent} sent)` };
  let bounced = 0, complained = 0;
  try {
    const since = new Date(Date.now() - windowMs);
    bounced = await prisma.recruiterSuppression.count({ where: { reason: 'bounce', createdAt: { gte: since } } });
    complained = await prisma.recruiterSuppression.count({ where: { reason: 'complaint', createdAt: { gte: since } } });
  } catch { return { ok: true, reason: 'health unknown' }; }
  if (bounced / sent > OUTREACH.maxBounceRate) return { ok: false, reason: `bounce ${(bounced / sent * 100).toFixed(1)}% > ${OUTREACH.maxBounceRate * 100}%` };
  if (complained / sent > OUTREACH.maxComplaintRate) return { ok: false, reason: `complaints ${(complained / sent * 100).toFixed(2)}% > ${OUTREACH.maxComplaintRate * 100}%` };
  return { ok: true };
}

/** Can we send to this company right now? Enforces master switch, health, suppression, daily cap, cooldown/follow-up. */
export async function canSendToCompany(opts: { email: string; domain: string }): Promise<Gate> {
  if (!OUTREACH.enabled) return { ok: false, reason: 'disabled (OUTREACH_ENABLED=false)' };
  const email = opts.email.toLowerCase().trim();
  if (!email.includes('@')) return { ok: false, reason: 'bad email' };

  const health = await outreachHealth();
  if (!health.ok) return { ok: false, reason: `kill-switch: ${health.reason}` };

  try {
    if (await prisma.recruiterSuppression.findUnique({ where: { email }, select: { email: true } }))
      return { ok: false, reason: 'suppressed' };
  } catch { /* if we can't check suppression, be safe and skip */ return { ok: false, reason: 'suppression check failed' }; }

  if (await countSent(864e5, { details: { path: ['ok'], equals: true } }) >= OUTREACH.dailyCap)
    return { ok: false, reason: `daily cap ${OUTREACH.dailyCap} reached` };

  // Per-company cooldown / follow-up budget.
  let touches: { createdAt: Date }[] = [];
  try {
    touches = await prisma.activityLog.findMany({
      where: { action: 'COMPANY_CARD_SENT', details: { path: ['domain'], equals: opts.domain },
        createdAt: { gte: new Date(Date.now() - OUTREACH.cooldownDays * 864e5) } },
      select: { createdAt: true }, orderBy: { createdAt: 'desc' },
    });
  } catch { /* treat as fresh */ }
  if (touches.length >= 1 + OUTREACH.maxFollowUps) return { ok: false, reason: 'cooldown: max touches' };
  if (touches.length >= 1) {
    const sinceLast = Date.now() - touches[0].createdAt.getTime();
    if (sinceLast < OUTREACH.followUpAfterDays * 864e5) return { ok: false, reason: 'too soon for follow-up' };
  }
  return { ok: true, reason: touches.length >= 1 ? 'follow-up' : 'first touch' };
}

// ── Email composition (self-contained; inline candidate list, no portal dependency) ─────────────
function esc(s: string): string { return (s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!)); }

// Map a candidate's freeform/multilingual self-title to a clean, standard English profession for the
// anonymous card headline ("Analista de reporting III" → "Data / BI Analyst"). Truthful to their real
// domain (never relabeled as the target role); falls back to a level-stripped version of the original.
export function normalizeProfession(title: string | null | undefined): string {
  const t = (title || '').toLowerCase();
  if (!t.trim()) return 'Professional';
  const has = (...ks: string[]) => ks.some(k => t.includes(k));
  if (has('full stack', 'full-stack', 'fullstack', 'full‑stack')) return 'Full-Stack Developer';
  if (has('front', 'react', 'angular', 'vue', 'frontend')) return 'Frontend Developer';
  if (has('back', 'java', 'node', '.net', 'golang', ' go ', 'php', 'ruby', 'django', 'spring', 'c#')) return 'Backend Developer';
  if (has('mobile', 'android', 'ios', 'flutter', 'react native', 'kotlin', 'swift')) return 'Mobile Developer';
  if (has('devops', 'sre', 'infra', 'cloud engineer', 'kubernetes', 'platform engineer')) return 'DevOps Engineer';
  if (has('qa', 'quality', 'tester', 'sdet', 'automation engineer')) return 'QA Engineer';
  if (has('data engineer', 'etl', 'data pipeline')) return 'Data Engineer';
  if (has('data scien', 'machine learning', 'ai engineer', 'ml engineer')) return 'Data Scientist';
  if (has('bi ', 'business intelligence', 'analyst', 'analista', 'report', 'power bi', 'tableau')) return 'Data / BI Analyst';
  if (has('design', 'diseñ', ' ux', 'ui/ux', 'product designer')) return 'Product Designer';
  if (has('product manager', 'product owner')) return 'Product Manager';
  if (has('engineer', 'developer', 'programmer', 'desarrollador', 'software', 'ingenier')) return 'Software Engineer';
  const cleaned = (title || '').replace(/\b(I{1,3}|IV|VI?|junior|senior|sr\.?|jr\.?|lead|principal|staff)\b/gi, '').replace(/\s+/g, ' ').trim();
  return cleaned || 'Professional';
}
export function cardEmail(company: string, role: string, cands: ShortlistCandidate[], portalUrl: string, unsub: string) {
  const n = cands.length;
  // Anonymized-but-rich teaser: profession (not name), the screening facts recruiters ask for
  // (years / timezone / start-date / availability / expected pay), a verified-GitHub / portfolio
  // badge (badge only — the actual link would de-anonymize, so it's the reward on the portal),
  // top skills, and the "why this fit" reasoning. Initials avatar (no photo — protects identity).
  const chip = 'display:inline-block;font-size:12px;background:#f5f4ef;border:1px solid #e6e4dd;border-radius:6px;padding:2px 7px;margin:0 4px 4px 0;';
  const rows = cands.map(c => {
    const profession = esc(normalizeProfession(c.title) || role || 'Candidate');
    const initials = esc((normalizeProfession(c.title) || 'C').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?');
    const avatar = `<div style="width:44px;height:44px;border-radius:50%;background:#c6f135;color:#111;font-weight:700;font-size:15px;text-align:center;line-height:44px;">${initials}</div>`;
    const bits: string[] = [];
    if (c.location) bits.push('📍 ' + esc(c.location));
    if (c.years != null) bits.push(esc(String(c.years)) + ' yrs exp');
    if (c.timezone) bits.push(esc(c.timezone));
    if (c.availableFrom) bits.push('starts ' + esc(c.availableFrom));
    if (c.availability) bits.push(esc(c.availability));
    if (c.salaryExpectation) bits.push('exp. pay ' + esc(c.salaryExpectation));
    const detail = bits.length ? `<div style="color:#555;font-size:13px;margin:3px 0;">${bits.join('  ·  ')}</div>` : '';
    const badges: string[] = [];
    if (c.githubVerified) badges.push('<span style="font-size:11px;font-weight:700;color:#166534;background:#dcfce7;border-radius:5px;padding:2px 7px;">✓ GitHub-verified</span>');
    if (c.videoIntro) badges.push('<span style="font-size:11px;font-weight:700;color:#1D4ED8;background:#DBEAFE;border-radius:5px;padding:2px 7px;">▶ Video intro available</span>');
    if (c.portfolioUrl) badges.push('<span style="font-size:11px;color:#555;background:#f0efe9;border-radius:5px;padding:2px 7px;">Portfolio available</span>');
    const badgeHtml = badges.length ? `<div style="margin:5px 0;">${badges.join(' ')}</div>` : '';
    const chips = (c.skills || []).slice(0, 8).map(s => `<span style="${chip}">${esc(s)}</span>`).join('');
    const chipHtml = chips ? `<div style="margin-top:4px;">${chips}</div>` : '';
    const why = typeof c.matchBreakdown?.recruiterReasoning === 'string' ? (c.matchBreakdown.recruiterReasoning as string).trim() : '';
    const whyHtml = why ? `<div style="color:#444;font-size:13px;line-height:1.5;margin-top:6px;"><span style="color:#7a7a7a;">Why this fit:</span> ${esc(why)}</div>` : '';
    return `<tr><td style="padding:14px 0;border-bottom:1px solid #eee;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        <td width="44" style="vertical-align:top;padding-right:12px;">${avatar}</td>
        <td style="vertical-align:top;">
          <strong style="font-size:15px;">${profession}</strong>${c.label ? ` <span style="color:#7a7a7a;font-size:13px;">— ${esc(c.label)} match</span>` : ''}
          ${detail}${badgeHtml}${chipHtml}${whyHtml}
        </td>
      </tr></table></td></tr>`;
  }).join('');
  const subject = n > 1 ? `${n} candidates for your ${role} role` : `A candidate for your ${role} role`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#222;">
    <p>Hi ${esc(company)} team,</p>
    <p>You have an open <strong>${esc(role)}</strong> role. ${n > 1 ? `Here are ${n} candidates` : `Here is a candidate`} from our pool who fit it — already vetted, available, and reachable:</p>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    <p style="margin-top:14px;color:#444;font-size:13.5px;line-height:1.55;">How this works: viewing profiles and interviewing costs nothing — a flat placement fee applies only if you hire, replacement guarantee included. Before any intro we re-confirm the candidate's availability directly, so you won't chase ghosts.</p>
    <p style="margin-top:18px;"><a href="${esc(portalUrl)}" style="background:#c6f135;color:#111;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">View profiles &amp; CVs →</a></p>
    <p style="color:#888;font-size:12px;margin-top:24px;">Reply to this email to connect with any of them. Not hiring right now? <a href="${esc(unsub)}">Unsubscribe</a> and we won't email again.</p>
  </div>`;
  const text = `Hi ${company} team,\n\nYou have an open ${role} role. ${n > 1 ? `${n} candidates` : `A candidate`} from our pool fit it:\n\n${cands.map(c => {
    const b: string[] = [c.location || 'Remote'];
    if (c.years != null) b.push(`${c.years}y exp`);
    if (c.availableFrom) b.push(`starts ${c.availableFrom}`);
    if (c.salaryExpectation) b.push(`exp. pay ${c.salaryExpectation}`);
    if (c.githubVerified) b.push('GitHub-verified');
    return `• ${normalizeProfession(c.title) || role || 'Candidate'}${c.label ? ` (${c.label})` : ''} — ${b.join(', ')}${c.skills?.length ? `\n  skills: ${c.skills.slice(0, 8).join(', ')}` : ''}`;
  }).join('\n')}\n\nHow it works: viewing profiles and interviewing is free — a flat placement fee applies only if you hire (replacement guarantee included). We re-confirm each candidate's availability before any intro.\n\nView profiles & CVs: ${portalUrl}\nReply to connect. Unsubscribe: ${unsub}`;
  return { subject, html, text };
}

export type CardSendResult = { sent: boolean; reason: string; messageId?: string };

/**
 * Send ONE company its shortlist — fully guarded. Never throws. Returns {sent:false, reason} when a
 * limit/gate blocks it (the normal case for most companies on most days).
 */
export async function sendCompanyCard(card: LeverCompanyCard, shortlist: ShortlistCandidate[]): Promise<CardSendResult> {
  const email = card.contact.email;
  if (!email) return { sent: false, reason: 'no contact' };
  if (!shortlist.length) return { sent: false, reason: 'no candidates' };

  const gate = await canSendToCompany({ email, domain: card.contact.domain });
  if (!gate.ok) return { sent: false, reason: gate.reason || 'blocked' };

  const role = card.roles[0]?.title || 'open role';
  const company = card.name || card.contact.domain.split('.')[0];
  const mail = cardEmail(company, role, shortlist, getRecruiterPortalUrl(email), getRecruiterUnsubscribeUrl(email));

  // Send FROM the isolated cold-outreach domain (OUTREACH.fromEmail, e.g. talent.freelanly.com) so a
  // reputation hit can't reach the OTP/auto-apply transactional domain. Replies land on that domain.
  let res: { success: boolean; messageId?: string; error?: string };
  try {
    res = await sendEmail({ to: email, from: OUTREACH.fromEmail, fromName: 'Freelanly Talent',
      subject: mail.subject, html: mail.html, text: mail.text,
      listUnsubscribe: getRecruiterUnsubscribeUrl(email) });
  } catch (e) { res = { success: false, error: (e as Error)?.message }; }

  // On a successful send, persist the shortlist so the email's "View profiles & CVs" link actually
  // shows these candidates in the /r portal (with CVs + reply). See persistShortlistCandidates.
  if (res.success) await persistShortlistCandidates(card, shortlist, role);

  await prisma.activityLog.create({
    data: {
      action: 'COMPANY_CARD_SENT',
      details: { domain: card.contact.domain, email, role, company, candidateCount: shortlist.length,
        followUp: gate.reason === 'follow-up', ok: !!res.success, messageId: res.messageId || null, err: res.error || null },
    },
  }).catch(() => {});

  return res.success
    ? { sent: true, reason: gate.reason || 'sent', messageId: res.messageId }
    : { sent: false, reason: `send failed: ${res.error || 'unknown'}` };
}

/**
 * Persist shortlist candidates as AutoApplication rows so the /r portal renders them (profiles, CVs,
 * reply all key on AutoApplication.id). Marked origin='SHORTLIST' with sentAt=NULL so they DON'T
 * count as candidate auto-apply "sends"; the portal query includes them via origin. Idempotent:
 * skips a candidate already carded to this recruiter for this role. Never throws.
 */
async function persistShortlistCandidates(card: LeverCompanyCard, shortlist: ShortlistCandidate[], role: string): Promise<void> {
  const email = card.contact.email!;
  const company = card.name || card.contact.domain.split('.')[0];
  for (const c of shortlist) {
    try {
      const existing = await prisma.autoApplication.findFirst({
        where: { userId: c.userId, appliedToEmail: email, jobTitle: role, origin: 'SHORTLIST' },
        select: { id: true },
      });
      if (existing) continue;
      // AutoApplication requires a loopId; reuse the candidate's own loop. Skip if they somehow have none.
      const loop = await prisma.autoApplyLoop.findFirst({ where: { userId: c.userId }, select: { id: true } });
      if (!loop) continue;
      const ratio = (c.matchBreakdown as { ratio?: number } | null)?.ratio;
      await prisma.autoApplication.create({
        data: {
          userId: c.userId,
          loopId: loop.id,
          appliedToEmail: email,
          companyName: company,
          jobTitle: role,
          coverLetter: '',
          subject: '',
          origin: 'SHORTLIST',
          status: 'SENT',           // display status in the portal; sentAt stays NULL (not a real send)
          matchScore: typeof ratio === 'number' ? Math.round(ratio * 100) : null,
          matchLabel: c.label ?? null,
          matchBreakdown: (c.matchBreakdown ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (e) {
      console.error('[persistShortlist] failed:', c.userId, (e as Error)?.message);
    }
  }
}
