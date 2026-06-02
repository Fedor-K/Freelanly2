// Honest match caveats surfaced to the recruiter (and the admin audit view).
// Derived from the frozen matchBreakdown the matcher already computes — no extra LLM.
// Strength = severity of caveats, used to sort/label. A clean match has zero caveats.
export type Caveats = { strength: 'Strong' | 'Good' | 'Weak'; items: string[] };

export function computeCaveats(bd: unknown): Caveats | null {
  if (!bd || typeof bd !== 'object') return null;
  const b = bd as Record<string, unknown>;
  if (b.error) return null;
  const lines = Array.isArray(b.lines) ? (b.lines as Array<Record<string, unknown>>) : [];
  const total = typeof b.total === 'number' ? b.total : lines.length;
  const matched = typeof b.matched === 'number' ? b.matched : lines.filter((l) => l?.status === 'full').length;
  const profession = typeof b.profession === 'string' ? b.profession : null;   // exact | adjacent (different never reaches the recruiter)
  const englishReq = typeof b.english_req === 'string' ? b.english_req : null;  // strong | weak | none
  const englishLevel = typeof b.english_level === 'string' ? b.english_level : null; // ok | b1 | low | unknown
  const missing = lines.filter((l) => l?.status !== 'full').map((l) => String(l?.label ?? '')).filter(Boolean);

  const items: string[] = [];
  if (profession === 'adjacent') items.push('Adjacent role — not an exact occupation match');
  if (total > 0 && missing.length) items.push(`Missing: ${missing.join(', ')}`);
  if (total === 0) items.push('No explicit requirements in the post — matched on profession only');
  // #2 — language caveat ONLY on an explicitly weak level (b1/low), never on "unknown" (avoids
  // spamming a low-signal badge across the 68% of candidates who don't state their English level).
  const engRisk = englishReq === 'strong' && (englishLevel === 'b1' || englishLevel === 'low');
  if (engRisk) items.push('English may be below what this role needs — worth verifying');

  if (items.length === 0) return { strength: 'Strong', items };
  const severe = engRisk || (profession === 'adjacent' && total >= 3 && matched < 2);
  return { strength: items.length >= 2 || severe ? 'Weak' : 'Good', items };
}
