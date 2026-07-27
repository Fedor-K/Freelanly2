import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { sendApplicationEmail } from '@/lib/email';

/**
 * Win-back email for abandoned BALANCE TOP-UPS (the $3 pay-per-apply PaymentIntents that show as
 * "Incomplete" in Stripe). The legacy abandoned-checkout email targets the dead Checkout-Session
 * subscription model, so those top-up abandoners never got anything. Here we read incomplete
 * apply_credits PaymentIntents straight from Stripe, grant the same one-time 50%-off the chat gives
 * (so the discounted $1.50 first-pack is waiting when they return), and email them once.
 *
 * Note: a chunk of these incompletes are cards the bank blocks (India / regional) where a discount
 * can't help — the email says as much and offers a reply-for-help path, so it's useful either way.
 */
const MIN_AGE_MIN = 45;      // give them time to finish on their own before nudging
const MAX_AGE_HOURS = 30;    // don't chase anything older than this
const DEDUP_DAYS = 4;        // at most one recovery email per user per window
const INCOMPLETE = ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'];

function recoveryEmailHtml(): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a2e05;">
  <div style="max-width:520px;margin:0 auto;padding:28px 22px;">
    <div style="background:#fff;border:1px solid #e6e8ec;border-radius:14px;padding:28px 24px;">
      <div style="font-size:22px;font-weight:800;margin-bottom:6px;">You were one click away 👀</div>
      <p style="font-size:15px;line-height:1.55;color:#3a3f47;">You started topping up your Freelanly balance but didn't finish. No worries — I saved you a deal to make it easy:</p>
      <div style="text-align:center;margin:20px 0;padding:16px;background:#f4fce8;border:2px solid #84cc16;border-radius:12px;">
        <div style="font-size:19px;font-weight:800;">First top-up 50% off</div>
        <div style="font-size:14px;color:#3a3f47;margin-top:4px;">$3 of balance <b>(6 applications)</b> for just <b>$1.50</b> — one time.</div>
      </div>
      <div style="text-align:center;margin:22px 0;">
        <a href="https://freelanly.com/dashboard/discovery?utm_source=email_abandoned_topup" style="display:inline-block;background:#84cc16;color:#1a2e05;font-weight:800;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:10px;">Claim 50% off &rarr;</a>
      </div>
      <p style="font-size:13px;line-height:1.5;color:#6b7280;">The discount is already on your account — just open any role, hit Apply, and you'll see the $1.50 first-pack.</p>
      <p style="font-size:13px;line-height:1.5;color:#6b7280;">Card wouldn't go through? That's common with some banks/countries and isn't your fault — just reply to this email and we'll sort an alternative.</p>
      <p style="font-size:12px;color:#9aa0a6;margin-top:22px;border-top:1px solid #eee;padding-top:14px;">Freelanly · <a href="https://freelanly.com/unsubscribe" style="color:#9aa0a6;">Unsubscribe</a></p>
    </div>
  </div></body></html>`;
}

export async function processAbandonedTopupRecovery(): Promise<{ scanned: number; emailed: number; skipped: number; failed: number }> {
  const stats = { scanned: 0, emailed: 0, skipped: 0, failed: 0 };
  const stripe = getStripe();
  const now = Date.now();

  const list = await stripe.paymentIntents.list({
    created: { gte: Math.floor((now - MAX_AGE_HOURS * 3600_000) / 1000) },
    limit: 100,
  });

  // A user who later succeeded is done; otherwise keep their most-recent incomplete top-up.
  const succeeded = new Set<string>();
  const incomplete = new Map<string, (typeof list.data)[number]>();
  for (const pi of list.data) {
    if (pi.metadata?.type !== 'apply_credits') continue;
    const uid = pi.metadata?.userId;
    if (!uid) continue;
    if (pi.status === 'succeeded') { succeeded.add(uid); continue; }
    if (INCOMPLETE.includes(pi.status) && !incomplete.has(uid)) incomplete.set(uid, pi);
  }

  for (const [uid, pi] of incomplete) {
    stats.scanned++;
    if (succeeded.has(uid)) { stats.skipped++; continue; }
    if ((now - pi.created * 1000) / 60000 < MIN_AGE_MIN) { stats.skipped++; continue; }

    const user = await prisma.user.findUnique({ where: { id: uid }, select: { id: true, email: true, unsubscribedFromMarketing: true } });
    if (!user?.email || user.unsubscribedFromMarketing) { stats.skipped++; continue; }

    const already = await prisma.activityLog.findFirst({
      where: { userId: uid, action: 'PAYWALL_CLOSE', details: { path: ['type'], equals: 'recovery_email' }, createdAt: { gte: new Date(now - DEDUP_DAYS * 24 * 3600_000) } },
      select: { id: true },
    });
    if (already) { stats.skipped++; continue; }

    try {
      // Grant the same one-time 50%-off the chat issues (only if they don't already hold an active one).
      const activeGrant = await prisma.activityLog.findFirst({
        where: { userId: uid, action: 'PAYWALL_CLOSE', details: { path: ['type'], equals: 'recovery_grant' } },
        orderBy: { createdAt: 'desc' }, select: { createdAt: true },
      });
      let hasActive = false;
      if (activeGrant) {
        const used = await prisma.activityLog.findFirst({
          where: { userId: uid, action: 'PAYWALL_CLOSE', details: { path: ['type'], equals: 'recovery_used' }, createdAt: { gte: activeGrant.createdAt } },
          select: { id: true },
        });
        hasActive = !used;
      }
      if (!hasActive) {
        await prisma.activityLog.create({ data: { userId: uid, action: 'PAYWALL_CLOSE', details: { type: 'recovery_grant', discountPct: 50, packCents: 150, credits: 6, source: 'email' } } });
      }

      const res = await sendApplicationEmail({ to: user.email, subject: 'You were one click away — 50% off your first top-up', html: recoveryEmailHtml() });
      await prisma.activityLog.create({ data: { userId: uid, action: 'PAYWALL_CLOSE', details: { type: 'recovery_email', paymentIntentId: pi.id, ok: res.success } } });
      if (res.success) stats.emailed++; else stats.failed++;
    } catch {
      stats.failed++;
    }
  }

  return stats;
}
