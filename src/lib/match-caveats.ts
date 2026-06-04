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
  const hardFail = b.hard_fail === true;
  const hardDetail = typeof b.hard_detail === 'string' ? b.hard_detail : '';
  const locationFlag = b.location_flag === true;
  const locationDetail = typeof b.location_detail === 'string' ? b.location_detail : '';
  const missingLines = lines.filter((l) => l?.status !== 'full');
  // Layer 2 — a missing CORE requirement (defines the role: in the title / mandatory) outweighs
  // a decent numerator: it's flagged separately and is severe (drops strength to Weak).
  const coreMissing = missingLines.filter((l) => l?.core === true).map((l) => String(l?.label ?? '')).filter(Boolean);
  const otherMissing = missingLines.filter((l) => l?.core !== true).map((l) => String(l?.label ?? '')).filter(Boolean);

  const items: string[] = [];
  // Hard, checkable requirement the candidate fails (education / cert / minimum-years) — most severe.
  if (hardFail) items.push(`Hard requirement not met: ${hardDetail || 'see job requirements'}`);
  // Missing a CORE/defining skill of the role (Layer 2) — severe even if other skills matched.
  if (coreMissing.length) items.push(`Missing CORE requirement: ${coreMissing.join(', ')}`);
  // Geographic mismatch — job tied to a place, remote unclear, candidate elsewhere (soft, verify).
  if (locationFlag) items.push(`Location mismatch: ${locationDetail || 'job and candidate in different countries'} — on-site/remote unclear`);
  if (profession === 'adjacent') items.push('Adjacent role — not an exact occupation match');
  if (total > 0 && otherMissing.length) items.push(`Missing: ${otherMissing.join(', ')}`);
  if (total === 0) items.push('No explicit requirements in the post — matched on profession only');
  // #2 — language caveat ONLY on an explicitly weak level (b1/low), never on "unknown" (avoids
  // spamming a low-signal badge across the 68% of candidates who don't state their English level).
  const engRisk = englishReq === 'strong' && (englishLevel === 'b1' || englishLevel === 'low');
  if (engRisk) items.push('English may be below what this role needs — worth verifying');

  if (items.length === 0) return { strength: 'Strong', items };
  const severe = hardFail || coreMissing.length > 0 || engRisk || (profession === 'adjacent' && total >= 3 && matched < 2);
  return { strength: items.length >= 2 || severe ? 'Weak' : 'Good', items };
}

// Verdict for the cover-letter generator, derived from the SAME frozen breakdown the recruiter
// sees — so the letter's honest-mode/missing-strip and the stored label all agree with the card.
export type MatchVerdict = { label?: 'Strong' | 'Good' | 'Weak'; matchedSkills: string[]; missingCore: string[]; missing: string[] };
export function breakdownToVerdict(bd: unknown): MatchVerdict | undefined {
  if (!bd || typeof bd !== 'object') return undefined;
  const b = bd as Record<string, unknown>;
  if (b.error) return undefined;
  const lines = Array.isArray(b.lines) ? (b.lines as Array<Record<string, unknown>>) : [];
  if (!lines.length) return undefined;
  const lbl = (l: Record<string, unknown>) => String(l?.label ?? '').trim();
  const matchedSkills = lines.filter((l) => l?.status === 'full').map(lbl).filter(Boolean);
  const missingCore = lines.filter((l) => l?.status !== 'full' && l?.core === true).map(lbl).filter(Boolean);
  const missing = lines.filter((l) => l?.status !== 'full' && l?.core !== true).map(lbl).filter(Boolean);
  return { label: computeCaveats(bd)?.strength, matchedSkills, missingCore, missing };
}
