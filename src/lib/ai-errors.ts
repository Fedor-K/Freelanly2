// Detect "AI provider is unavailable" errors — out of balance (HTTP 429 "Insufficient balance or
// no resource package"), rate-limited, or overloaded. Used to FAIL CLOSED in the auto-apply matcher:
// when the model can't be reached we must NOT fall back to a blind, unverified send (a generic
// template cover letter + skipped skill gate). Instead the pairing's error propagates so the matcher
// leaves the opportunity unmarked and retries it on a later run, once the provider has recovered.
export function isAiUnavailable(e: unknown): boolean {
  const err = e as { status?: number; code?: number; response?: { status?: number }; message?: string } | null;
  const status = err?.status ?? err?.code ?? err?.response?.status;
  if (status === 429 || status === 503 || status === 529) return true;
  const msg = String(err?.message ?? e ?? '').toLowerCase();
  return msg.includes('insufficient balance')
    || msg.includes('no resource package')
    || msg.includes('rate limit')
    || msg.includes('429')
    || msg.includes('too many requests');
}
