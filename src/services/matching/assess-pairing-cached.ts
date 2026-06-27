// Cached wrapper around assessPairing (the AI gate). Stores the verdict per (user × opportunity) in
// PairingVerdict so: the feed can hide pairs the gate would reject, the apply path skips the 5-7s
// recompute (and the LLM cost), and feed↔apply stop disagreeing. Fail-open: any cache error falls
// through to a live assessPairing — the cache can never block a real apply.
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { breakdownToVerdict } from '@/lib/match-caveats';
import { assessPairing, type PairingInput, type Pairing } from './assess-pairing';

const TTL_MS = 14 * 864e5; // 14 days — within an opportunity's 30-day lifespan

/** Stable fingerprint of the candidate profile state — changes when the résumé/skills/title change,
 *  so a stale verdict for an updated profile is recomputed instead of served. */
export function profileStamp(parts: { resumeUrl?: string | null; skills?: string[]; title?: string | null }): string {
  const s = `${parts.resumeUrl || ''}|${(parts.skills || []).map(x => String(x).toLowerCase().trim()).filter(Boolean).sort().join(',')}|${(parts.title || '').toLowerCase().trim()}`;
  return createHash('sha1').update(s).digest('hex').slice(0, 16);
}

export async function assessPairingCached(
  key: { userId: string; opportunityId: string; stamp: string },
  inp: PairingInput,
): Promise<Pairing & { cached: boolean }> {
  try {
    const hit = await prisma.pairingVerdict.findUnique({
      where: { userId_opportunityId: { userId: key.userId, opportunityId: key.opportunityId } },
    });
    if (hit && hit.profileStamp === key.stamp && Date.now() - hit.createdAt.getTime() < TTL_MS) {
      const bd = (hit.matchBreakdown as Record<string, unknown> | null) || null;
      return {
        matchBreakdown: bd,
        verdict: bd ? breakdownToVerdict(bd) : undefined,
        label: (hit.label as Pairing['label']) ?? undefined,
        decision: hit.decision as 'NO' | 'SEND',
        reason: hit.reason || '',
        ok: true, // a cached verdict only got persisted because it was ok (APCACHE-3 never caches fail-open)
        cached: true,
      };
    }
  } catch { /* fall through to a live assessment */ }

  const p = await assessPairing(inp);
  // APCACHE-3: NEVER persist a fail-open verdict (gate/parse threw → blanket SEND, no real gate).
  // Caching it would freeze a transient z.ai outage into a 14-day "SEND" for a pair the gate would
  // actually reject. Skip the write so the next apply re-assesses live once the provider is back.
  if (p.ok) {
    try {
      const bd = p.matchBreakdown ? (p.matchBreakdown as Prisma.InputJsonValue) : Prisma.JsonNull;
      await prisma.pairingVerdict.upsert({
        where: { userId_opportunityId: { userId: key.userId, opportunityId: key.opportunityId } },
        create: { userId: key.userId, opportunityId: key.opportunityId, decision: p.decision, label: p.label ?? null, reason: p.reason || null, matchBreakdown: bd, profileStamp: key.stamp },
        update: { decision: p.decision, label: p.label ?? null, reason: p.reason || null, matchBreakdown: bd, profileStamp: key.stamp, createdAt: new Date() },
      });
    } catch { /* cache write is best-effort */ }
  }
  return { ...p, cached: false };
}
