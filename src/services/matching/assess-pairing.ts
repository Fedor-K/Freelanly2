// Assess a single candidate↔opportunity pairing for the user-initiated apply routes (quick-apply /
// draft-apply). Same engine as the autonomous matcher: parse the JD, verify skills (breakdown),
// run the gate, and produce the verdict that drives the honest cover letter — so a self-apply gets
// the SAME verifier/gate/verdict as an auto-apply (no more "—" no-breakdown, no over-promising).
import { parseJD, buildBreakdown } from '@/lib/match-breakdown/generate';
import { runGate, assess } from '@/services/matching/gate';
import { computeCaveats, breakdownToVerdict, type MatchVerdict } from '@/lib/match-caveats';

export type PairingInput = {
  jobTitle: string;
  jobDescription: string;
  jobCountry?: string | null;
  profile: Record<string, unknown> | null; // parsedProfile
  cvText: string;
  hasRealCV: boolean;
};

export type Pairing = {
  matchBreakdown: Record<string, unknown> | null;
  verdict: MatchVerdict | undefined;
  label: 'Strong' | 'Good' | 'Weak' | undefined;
  decision: 'NO' | 'SEND';
  reason: string;
  ok: boolean; // false = the gate/parse FAILED OPEN (transient outage, no real verdict). Caller still
               // gets a SEND so a user-initiated apply isn't blocked, but it must NOT be CACHED — else
               // one z.ai blip freezes a hard-NO pair as a 14-day cached SEND (APCACHE-3).
};

const EMPTY: Pairing = { matchBreakdown: null, verdict: undefined, label: undefined, decision: 'SEND', reason: '', ok: false };

export async function assessPairing(inp: PairingInput): Promise<Pairing> {
  try {
    const p = inp.profile || {};
    const jdText = `${inp.jobTitle}\n${inp.jobDescription}`;
    const jd = await parseJD(jdText, inp.jobTitle);
    const bd = buildBreakdown(jd, {
      jdText, cvText: inp.cvText,
      candidateSkills: (p.skills as string[]) || [],
      candidateLanguages: (p.languages as string[]) || [],
      candidateTitle: typeof p.current_title === 'string' ? (p.current_title as string) : null,
      candidateYears: typeof p.experience_years === 'number' ? (p.experience_years as number) : null,
      candidateLocation: typeof p.location === 'string' ? (p.location as string) : null,
    });
    // CORE is verified DETERMINISTICALLY ONLY (lexical: synonym/alias/title/anyOf/implies). No LLM
    // "learnability" appeal for a role-defining skill — an LLM promotion of a missing core (e.g.
    // "WCF implies UI automation") is a hallucination that sends a weak letter to a real recruiter.
    // A core that is lexically missing stays missing → gated. (Owner decision: precision over recall.)
    const ratio = bd.total ? bd.matched / bd.total : 0;
    const bdLines = (bd.lines as Array<{ core?: boolean; status?: string }>) || [];
    const missingCore = bdLines.filter((l) => l.core === true && l.status !== 'full').length;
    const coreMatched = bdLines.filter((l) => l.core === true && l.status === 'full').length;
    const matchBreakdown: Record<string, unknown> = {
      v: 1, matched: bd.matched, total: bd.total, ratio: Math.round(ratio * 100) / 100, lines: bd.lines,
      yearsContext: bd.yearsContext, locationContext: bd.locationContext, rejected: bd.rejected, fallback: bd.fallback,
    };
    let decision: 'NO' | 'SEND' = 'SEND';
    let reason = '';
    let ok = true; // becomes false if the gate throws — a fail-open SEND with no real verdict
    try {
      const g = await runGate({
        jobTitle: inp.jobTitle, jobDescription: inp.jobDescription, jobCountry: inp.jobCountry ?? null,
        candidateTitle: typeof p.current_title === 'string' ? (p.current_title as string) : undefined,
        candidateField: typeof p.field === 'string' ? (p.field as string) : undefined,
        candidateYears: typeof p.experience_years === 'number' ? (p.experience_years as number) : null,
        candidateLocation: typeof p.location === 'string' ? (p.location as string) : undefined,
        candidateLanguages: (p.languages as string[]) || [],
        candidateSkills: (p.skills as string[]) || [],
        candidateCv: inp.cvText,
      });
      const d = assess(g, { matched: bd.matched, total: bd.total, missingCore, coreMatched }, inp.cvText, inp.jobTitle, inp.hasRealCV);
      Object.assign(matchBreakdown, {
        profession: d.extras.profession, english_req: d.extras.english_req, english_level: d.extras.english_level,
        hard_fail: d.extras.hard_fail, hard_kind: d.extras.hard_kind, hard_detail: d.extras.hard_detail,
        location_flag: d.extras.location_flag, location_detail: d.extras.location_detail, gateReason: d.reason,
      });
      decision = d.decision; reason = d.reason;
    } catch { ok = false; /* gate fail-open: SEND with breakdown only — mark unvetted so it isn't cached */ }
    return { matchBreakdown, verdict: breakdownToVerdict(matchBreakdown), label: computeCaveats(matchBreakdown)?.strength, decision, reason, ok };
  } catch (e) {
    console.error('[assessPairing] failed (fail-open):', e);
    return EMPTY;
  }
}
