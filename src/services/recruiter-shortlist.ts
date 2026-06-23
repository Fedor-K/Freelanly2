// Block 2 — for ONE ATS role, pick the best 3 vetted candidates from our pool.
//
// Reverse of the normal matcher (which goes candidate→opportunities): here we have one Lever role
// and rank candidates against it. Two passes to keep LLM cost sane:
//   1. lexical pre-rank the whole full-cycle pool (no LLM) → top N
//   2. vet those N with assessPairing (the SAME gate/verifier as auto-apply) → keep SEND, take 3
// Output feeds the recruiter shortlist card (block 4).
import { prisma } from '@/lib/db';
import { assessPairing } from '@/services/matching/assess-pairing';
import type { LeverPosting } from '@/services/sources/lever-ats';

const LABEL_RANK: Record<string, number> = { Strong: 0, Good: 1, Weak: 2 };

// Cheap lexical fit: candidate skills/title tokens that appear in the role text.
function lexScore(profile: unknown, roleText: string): number {
  const p = (profile || {}) as Record<string, unknown>;
  const skills = ((p.skills as string[]) || []).map(s => String(s).toLowerCase());
  const title = String(p.current_title || '').toLowerCase();
  const hay = roleText.toLowerCase();
  let score = 0;
  for (const s of skills) if (s.length > 2 && hay.includes(s)) score += 2;
  for (const w of title.split(/[^a-z0-9+#.]+/)) if (w.length > 3 && hay.includes(w)) score += 1;
  return score;
}

export type ShortlistCandidate = {
  userId: string;
  name: string | null;
  email: string;
  location: string | null;
  linkedinUrl: string | null;
  label: string | undefined;            // Strong | Good | Weak
  matchBreakdown: Record<string, unknown> | null;
  lexScore: number;
};

/** Pick the top `limit` vetted candidates for a Lever role. */
export async function buildShortlistForRole(
  role: LeverPosting,
  opts: { pre?: number; limit?: number } = {},
): Promise<ShortlistCandidate[]> {
  const pre = opts.pre ?? 12;
  const limit = opts.limit ?? 3;
  const roleText = `${role.title}\n${role.requirements.join('\n')}\n${role.descriptionPlain}`;

  // Pass 1 — lexical pre-rank the full-cycle pool (light fields only, no LLM).
  const pool = await prisma.user.findMany({
    where: { resumeUrl: { not: null } },
    select: { id: true, parsedProfile: true },
  });
  const ranked = pool
    .map(u => ({ id: u.id, s: lexScore(u.parsedProfile, roleText) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, pre);
  if (!ranked.length) return [];

  // Pass 2 — fetch full profiles for the shortlist + LLM-vet each.
  const ids = ranked.map(r => r.id);
  const full = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true, location: true, linkedinUrl: true, parsedProfile: true, resumeText: true },
  });
  const byId = new Map(full.map(u => [u.id, u]));

  const vetted: ShortlistCandidate[] = [];
  for (const r of ranked) {
    const u = byId.get(r.id);
    if (!u) continue;
    const pairing = await assessPairing({
      jobTitle: role.title,
      jobDescription: role.descriptionPlain,
      jobCountry: role.country,
      profile: (u.parsedProfile as Record<string, unknown>) || null,
      cvText: u.resumeText || '',
      hasRealCV: !!u.resumeText,
    });
    if (pairing.decision !== 'SEND') continue;
    vetted.push({
      userId: u.id, name: u.name, email: u.email, location: u.location, linkedinUrl: u.linkedinUrl,
      label: pairing.label, matchBreakdown: pairing.matchBreakdown, lexScore: r.s,
    });
  }

  return vetted
    .sort((a, b) => (LABEL_RANK[a.label || 'Weak'] - LABEL_RANK[b.label || 'Weak']) || (b.lexScore - a.lexScore))
    .slice(0, limit);
}
