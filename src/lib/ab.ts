import { createHash } from 'crypto';

/**
 * Stable 50/50 A/B bucket for a user within a named experiment. Deterministic: the same
 * (userId, experiment) always returns the same bucket, so a user's experience is consistent
 * across page loads and we can attribute conversion by bucket. Hash both together so different
 * experiments split independently (a user in 'A' for one can be 'B' for another).
 */
export function abBucket(userId: string, experiment: string): 'A' | 'B' {
  const h = createHash('sha256').update(`${experiment}:${userId}`).digest();
  return (h[0] & 1) === 0 ? 'A' : 'B';
}
