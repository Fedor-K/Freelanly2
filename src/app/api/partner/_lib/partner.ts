import { NextRequest } from 'next/server';

/**
 * Partner API — server-to-server surface for the IntentPond watcher products
 * (reactwatcher.com / qawatcher.com / pythonwatcher.com …). The watcher apps own
 * UX, sessions and billing; the engine executes the heavy operations (branded OTP
 * email, account creation, letter drafting, sending) against the shared DB so no
 * apply/dedup/deliverability logic is duplicated across stamped repos.
 *
 * Auth: every request must carry `x-partner-secret: $PARTNER_API_SECRET`.
 * All routes 404 when the secret env is unset — the surface simply doesn't exist
 * unless explicitly configured.
 */

export type PartnerBrand = {
  name: string;   // "QAWatcher"
  domain: string; // "qawatcher.com"
};

export function checkPartnerSecret(request: NextRequest): boolean {
  const secret = process.env.PARTNER_API_SECRET;
  if (!secret) return false;
  const got = request.headers.get('x-partner-secret') || '';
  return got.length === secret.length && got === secret;
}

export function sanitizeBrand(raw: unknown): PartnerBrand | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const name = String(b.name || '').slice(0, 40).replace(/[<>"]/g, '');
  const domain = String(b.domain || '').slice(0, 60).toLowerCase().replace(/[^a-z0-9.-]/g, '');
  if (!name || !domain) return null;
  return { name, domain };
}
