import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/postal';

/**
 * Win-back email for abandoned WATCHER $19/mo subscriptions — the ones that show as
 * "Incomplete" in Stripe (sub created, card form never completed). The abandon chat only
 * catches people still on-site; this reaches the ones who already left. Branded per watcher
 * (metadata.watcher/domain set by the watcher's billing/subscribe). The 50%-off first month
 * is applied automatically when they return (billing/subscribe discounts returning abandoners),
 * so the email just brings them back.
 */
const MIN_AGE_MIN = 45;      // let them finish on their own first
const MAX_AGE_HOURS = 23;    // incomplete subs auto-expire ~23h; chase inside that
const DEDUP_DAYS = 4;

function html(brand: string, domain: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;background:#F4F7FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14202F">
  <div style="max-width:520px;margin:0 auto;padding:34px 20px">
    <div style="font-size:16px;font-weight:600;margin-bottom:6px">${brand}</div>
    <p style="font-size:15px;line-height:1.55;color:#3a3f47">You started unlocking the direct reply path on ${brand} but didn't finish. No worries — here's a hand:</p>
    <div style="text-align:center;margin:20px 0;padding:16px;background:#EAF2FF;border:2px solid #14202F;border-radius:12px">
      <div style="font-size:19px;font-weight:800">50% off your first month</div>
      <div style="font-size:14px;color:#3a3f47;margin-top:4px"><b>$7</b> instead of $13.99 — applied automatically when you finish.</div>
    </div>
    <div style="text-align:center;margin:22px 0">
      <a href="https://${domain}/app?src=winback" style="display:inline-block;background:#14202F;color:#fff;font-weight:800;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:10px">Finish &amp; unlock &rarr;</a>
    </div>
    <p style="font-size:13px;line-height:1.5;color:#6b7280">Card wouldn't go through? That's common with some banks/countries — reply to this email and we'll sort an alternative.</p>
    <p style="font-size:12px;color:#9aa0a6;margin-top:20px;border-top:1px solid #e6e8ec;padding-top:14px">${brand} · an IntentPond product</p>
  </div>
</body></html>`;
}

export async function processAbandonedWatcherSubs(): Promise<{ scanned: number; emailed: number; skipped: number; failed: number }> {
  const stats = { scanned: 0, emailed: 0, skipped: 0, failed: 0 };
  const stripe = getStripe();
  const now = Date.now();

  const subs = await stripe.subscriptions.list({ status: 'incomplete', limit: 100 });
  for (const sub of subs.data) {
    const brand = sub.metadata?.watcher;
    const userId = sub.metadata?.userId;
    if (!brand || !userId) continue; // not one of our watcher subs
    // Subs created before the domain metadata existed: derive it from the brand name
    // (QAWatcher -> qawatcher.com), which is exactly how the 4 watcher domains are named.
    const domain = sub.metadata?.domain || `${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    stats.scanned++;

    const ageMin = (now - sub.created * 1000) / 60000;
    if (ageMin < MIN_AGE_MIN || ageMin > MAX_AGE_HOURS * 60) { stats.skipped++; continue; }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, unsubscribedFromMarketing: true } });
    if (!user?.email || user.unsubscribedFromMarketing) { stats.skipped++; continue; }

    const already = await prisma.activityLog.findFirst({
      where: { userId, action: 'PAYWALL_CLOSE', details: { path: ['type'], equals: 'watcher_winback_email' }, createdAt: { gte: new Date(now - DEDUP_DAYS * 86400_000) } },
      select: { id: true },
    });
    if (already) { stats.skipped++; continue; }

    try {
      const res = await sendEmail({
        to: user.email,
        subject: `Finish your ${brand} subscription — 50% off your first month`,
        html: html(brand, domain),
        text: `You didn't finish subscribing to ${brand}. Here's 50% off your first month ($7 instead of $13.99), applied automatically when you finish: https://${domain}/app?src=winback`,
        fromName: brand,
        from: `billing@${domain}`,
      });
      await prisma.activityLog.create({ data: { userId, action: 'PAYWALL_CLOSE', details: { type: 'watcher_winback_email', domain, subId: sub.id, ok: res.success } } });
      if (res.success) stats.emailed++; else stats.failed++;
    } catch {
      stats.failed++;
    }
  }
  return stats;
}
