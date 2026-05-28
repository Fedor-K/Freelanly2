// Recruiter match-breakdown engine. INVARIANT: no line exists without a trace to source.
//   LLM does only two things: (1) parse the JD into typed must-have requirements, (2) write
//   the summary prose. CODE asserts: verify-on-JD (#1), verify-in-CV (#2 via verify.ts), and
//   token-identity (requirement == evidence) collapses "satisfies" (#3).
// Only HARD-VERIFIABLE types get a status (skill / language). Years & location are SOFT
// context (no status, not in X/Y). "X or equivalent" is modelled as an ANY-OF group: a match
// of ANY enumerated member = full; if equivalents can't be safely named, the requirement is
// DROPPED (never reduced to the example — that would assert a requirement the JD didn't make).
import OpenAI from 'openai';
import { verifySkill, type VerifyResult } from './verify';

const AI_PROVIDER = (process.env.AI_PROVIDER || 'deepseek').toLowerCase();
function aiClient(): OpenAI {
  return AI_PROVIDER === 'zai'
    ? new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' })
    : new OpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: process.env.DEEPSEEK_API_KEY || '' });
}
const MODEL = AI_PROVIDER === 'zai' ? 'glm-4-32b-0414-128k' : 'deepseek-chat';

type SkillReq = { display: string; anyOf: string[] }; // anyOf = atomic tool names; match ANY = full
export type ParsedJD = { skills: SkillReq[]; languages: string[]; years?: number | null; location?: string | null };
export type Line = { label: string; type: 'skill' | 'language'; status: 'full' | 'missing'; evidence: string | null; source: 'cv' | 'profile' | null; viaAlias?: boolean; viaCollapse?: boolean; anyOfSize?: number; member?: string; searched?: string[] };
export type Rejected = { side: 'jd'; type: string; label: string };
export type Breakdown = {
  lines: Line[];
  matched: number; total: number;
  yearsContext: string | null;
  locationContext: string | null;
  summary: string | null;
  rejected: Rejected[];
  fallback: boolean;
  salaryContext: string | null;   // SOFT (self-reported), no status, not in X/Y; decayed if stale
};

// (1) LLM → typed requirements. Atomic tokens, any-of for "or equivalent", no invented reqs.
// Exported so the send-path can parse a JD ONCE per opportunity and reuse across candidates.
export async function parseJD(jdText: string): Promise<ParsedJD> {
  const r = await aiClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: `Extract ONLY explicit must-have requirements from this job post. Return JSON:
{"skills":[{"display":"string","anyOf":["atomic tool name", ...]}],"languages":["English"],"years":number|null,"location":"string|null"}
RULES:
- Each skill = ONE concrete tool/technology/competency literally named in the post. SPLIT lists ("Python, pandas, scikit-learn" → three separate skills). Max 5 skills, most important first.
- "anyOf" = atomic tool names (each a single tool, never a phrase/clause). For a plain skill, anyOf is just [that skill].
- For "X or equivalent / or similar" requirements: set anyOf to the concrete equivalents you are CONFIDENT are real (e.g. {"display":"experiment tracking","anyOf":["MLflow","Weights & Biases","Neptune","Comet"]}). If you cannot name real equivalents, OMIT the requirement entirely. NEVER reduce "X or equivalent" to just X.
- "languages" = spoken languages ONLY if the post explicitly requires them. Do NOT add English by default.
- "years" = minimum years if explicitly stated, else null. "location" = required country/timezone if stated, else null.
- Do NOT invent or infer requirements not in the text. Do NOT include soft/vague traits (leadership, team player, fast learner). JSON only.` },
      { role: 'user', content: jdText.slice(0, 4000) },
    ],
    temperature: 0,
    max_tokens: 500,
  });
  const m = (r.choices[0]?.message?.content || '').match(/\{[\s\S]*\}/);
  if (!m) return { skills: [], languages: [] };
  try {
    const p = JSON.parse(m[0]);
    const skills: SkillReq[] = (Array.isArray(p.skills) ? p.skills : [])
      .map((s: unknown): SkillReq | null => {
        if (typeof s === 'string') return { display: s, anyOf: [s] };
        const o = s as { display?: string; anyOf?: unknown };
        const anyOf = (Array.isArray(o.anyOf) ? o.anyOf : []).map(String).map((x) => x.trim()).filter(Boolean).slice(0, 5);
        if (!anyOf.length) return null;
        return { display: (o.display || anyOf[0]).trim(), anyOf };
      })
      .filter((s: SkillReq | null): s is SkillReq => !!s)
      .slice(0, 5);
    return {
      skills,
      languages: (Array.isArray(p.languages) ? p.languages : []).map(String),
      years: typeof p.years === 'number' ? p.years : null,
      location: typeof p.location === 'string' ? p.location : null,
    };
  } catch { return { skills: [], languages: [] }; }
}

// verify-on-JD (#1): requirement is real only if at least one of its tokens is literally in the JD.
function anyInJD(tokens: string[], jdText: string): boolean {
  return tokens.some((t) => verifySkill(t, jdText, []).found);
}

export type GenInput = {
  jdText: string; cvText: string;
  candidateSkills: string[]; candidateLanguages: string[];
  candidateYears?: number | null; candidateLocation?: string | null;
  candidateSalary?: string | null; candidateSalaryAt?: string | null; // self-reported "1500/mo" + when
};

export async function generateBreakdown(inp: GenInput): Promise<Breakdown> {
  const jd = await parseJD(inp.jdText);
  return buildBreakdown(jd, inp);
}

// Pure, synchronous, no LLM — code-only verification. Safe to call per-candidate with a JD
// parsed once per opportunity (the LLM cost lives in parseJD).
export function buildBreakdown(jd: ParsedJD, inp: GenInput): Breakdown {
  const rejected: Rejected[] = [];
  const lines: Line[] = [];
  const haystackSkills = `${inp.cvText} ${inp.candidateSkills.join(' , ')}`;

  // SKILLS — any-of group, token-identity (no paraphrase → no #3)
  for (const req of jd.skills) {
    if (!anyInJD(req.anyOf, inp.jdText)) { rejected.push({ side: 'jd', type: 'skill', label: req.display }); continue; } // #1
    let hit: VerifyResult | null = null; let hitMember = '';
    for (const member of req.anyOf) {
      const v = verifySkill(member, haystackSkills, inp.candidateSkills);
      if (v.found) { hit = v; hitMember = member; break; }
    }
    if (hit) {
      lines.push({ label: req.display, type: 'skill', status: 'full', evidence: hit.matched || hitMember, source: 'cv',
        viaAlias: (hit.matched || '').toLowerCase() !== hitMember.toLowerCase(), viaCollapse: hit.via === 'collapse', anyOfSize: req.anyOf.length, member: hitMember, searched: req.anyOf });
    } else {
      lines.push({ label: req.display, type: 'skill', status: 'missing', evidence: null, source: null, anyOfSize: req.anyOf.length, searched: req.anyOf });
    }
  }

  // LANGUAGES — only if explicitly in JD (verify-on-JD), then verified against candidate languages
  for (const raw of jd.languages.slice(0, 3)) {
    const label = raw.trim();
    if (!label) continue;
    if (!anyInJD([label], inp.jdText)) { rejected.push({ side: 'jd', type: 'language', label }); continue; }
    const v = verifySkill(label, inp.candidateLanguages.join(' , '), inp.candidateLanguages);
    lines.push({ label, type: 'language', status: v.found ? 'full' : 'missing', evidence: v.found ? (v.matched || label) : null, source: v.found ? 'profile' : null, member: v.found ? label : undefined, searched: [label] });
  }

  const matched = lines.filter((l) => l.status === 'full').length;
  const total = lines.length;

  let yearsContext: string | null = null;
  if (inp.candidateYears && inp.candidateYears > 0)
    yearsContext = `~${Math.round(inp.candidateYears)} yrs experience` + (jd.years ? ` (role asks ${jd.years}+)` : '');
  let locationContext: string | null = null;
  if (inp.candidateLocation && jd.location) locationContext = `${inp.candidateLocation} · role: ${jd.location}`;

  // SALARY — soft, self-reported. Never statused, never in X/Y. Decay stale self-reports (>90d).
  let salaryContext: string | null = null;
  if (inp.candidateSalary) {
    const ageMs = inp.candidateSalaryAt ? Date.now() - new Date(inp.candidateSalaryAt).getTime() : Infinity;
    const stale = ageMs > 90 * 24 * 3600 * 1000;
    salaryContext = `expects $${inp.candidateSalary}` + (stale ? ' (stated earlier — may be outdated)' : '');
  }

  // Fallback ONLY for thin data (nothing verifiable) — NEVER to hide a weak-but-honest match.
  const fallback = total < 1;

  return { lines, matched, total, yearsContext, locationContext, salaryContext, summary: null, rejected, fallback };
}
