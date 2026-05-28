// Recruiter match-breakdown engine. INVARIANT: no line exists without a trace to source.
//   LLM does only two things: (1) parse the JD into typed must-have requirements, (2) write
//   the summary prose. CODE does everything that asserts: verify-on-JD (#1), verify-in-CV
//   (#2, via verify.ts), and — by using the SAME token as requirement AND evidence — there is
//   no paraphrase, so "satisfies the requirement" (#3) collapses into the verified match.
// Only HARD-VERIFIABLE requirement types get a status (skill / language). Years & location are
// SOFT context (no status, not in the X/Y denominator) — the number/location are estimates.
import OpenAI from 'openai';
import { verifySkill, type VerifyResult } from './verify';

const AI_PROVIDER = (process.env.AI_PROVIDER || 'deepseek').toLowerCase();
function aiClient(): OpenAI {
  return AI_PROVIDER === 'zai'
    ? new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' })
    : new OpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: process.env.DEEPSEEK_API_KEY || '' });
}
const MODEL = AI_PROVIDER === 'zai' ? 'glm-4-32b-0414-128k' : 'deepseek-chat';

type ParsedJD = { skills: string[]; languages: string[]; years?: number | null; location?: string | null };
export type Line = { label: string; type: 'skill' | 'language'; status: 'full' | 'missing'; evidence: string | null; source: 'cv' | 'profile' | null };
export type Rejected = { side: 'jd' | 'cv'; type: string; label: string };
export type Breakdown = {
  lines: Line[];
  matched: number; total: number;
  yearsContext: string | null;     // soft, no status
  locationContext: string | null;  // soft, no status
  summary: string | null;
  rejected: Rejected[];
  fallback: boolean;               // true → show cover letter instead (data too thin)
};

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9+#./\- ]+/g, ' ').replace(/\s+/g, ' ').trim();

// (1) LLM → typed requirements. Cap 5 skills. Conservative: only clear must-haves.
async function parseJD(jdText: string): Promise<ParsedJD> {
  const r = await aiClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: `Extract ONLY explicit must-have requirements from this job post. Return JSON:
{"skills":["..."],"languages":["English"],"years":number|null,"location":"string|null"}
Rules: skills = concrete tools/technologies/competencies literally named in the post (max 5, most important first). languages = spoken languages required. years = minimum years of experience if explicitly stated, else null. location = required country/timezone if stated, else null. Do NOT invent or infer requirements that aren't in the text. Do NOT include soft/vague traits (leadership, team player, fast learner). JSON only.` },
      { role: 'user', content: jdText.slice(0, 4000) },
    ],
    temperature: 0,
    max_tokens: 400,
  });
  const m = (r.choices[0]?.message?.content || '').match(/\{[\s\S]*\}/);
  if (!m) return { skills: [], languages: [] };
  try {
    const p = JSON.parse(m[0]);
    return {
      skills: Array.isArray(p.skills) ? p.skills.map(String) : [],
      languages: Array.isArray(p.languages) ? p.languages.map(String) : [],
      years: typeof p.years === 'number' ? p.years : null,
      location: typeof p.location === 'string' ? p.location : null,
    };
  } catch { return { skills: [], languages: [] }; }
}

// verify-on-JD (#1): the requirement must lexically appear in the JD text, else it's hallucinated.
function inJD(token: string, jdText: string): boolean {
  return verifySkill(token, jdText, []).found;
}

export type GenInput = {
  jdText: string;
  cvText: string;
  candidateSkills: string[];
  candidateLanguages: string[];
  candidateYears?: number | null;
  candidateLocation?: string | null;
};

export async function generateBreakdown(inp: GenInput): Promise<Breakdown> {
  const rejected: Rejected[] = [];
  const lines: Line[] = [];
  const jd = await parseJD(inp.jdText);

  const haystackSkills = `${inp.cvText} ${inp.candidateSkills.join(' , ')}`;

  // SKILLS — statused, token-identity (requirement == evidence; no paraphrase → no #3)
  for (const raw of jd.skills.slice(0, 5)) {
    const label = raw.trim();
    if (!label) continue;
    if (!inJD(label, inp.jdText)) { rejected.push({ side: 'jd', type: 'skill', label }); continue; } // #1
    const v: VerifyResult = verifySkill(label, haystackSkills, inp.candidateSkills);
    if (v.found) {
      lines.push({ label, type: 'skill', status: 'full', evidence: v.matched || label, source: 'cv' });
    } else {
      lines.push({ label, type: 'skill', status: 'missing', evidence: null, source: null });
    }
  }

  // LANGUAGES — statused, verified against candidate languages
  for (const raw of jd.languages.slice(0, 3)) {
    const label = raw.trim();
    if (!label) continue;
    if (!inJD(label, inp.jdText)) { rejected.push({ side: 'jd', type: 'language', label }); continue; }
    const v = verifySkill(label, inp.candidateLanguages.join(' , '), inp.candidateLanguages);
    lines.push({ label, type: 'language', status: v.found ? 'full' : 'missing', evidence: v.found ? (v.matched || label) : null, source: v.found ? 'profile' : null });
  }

  const matched = lines.filter((l) => l.status === 'full').length;
  const total = lines.length;

  // YEARS — soft context only, no status, not in X/Y. Conservative "~N years".
  let yearsContext: string | null = null;
  if (inp.candidateYears && inp.candidateYears > 0) {
    yearsContext = `~${Math.round(inp.candidateYears)} yrs experience` + (jd.years ? ` (role asks ${jd.years}+)` : '');
  }

  // LOCATION — soft context only (estimate-grade), no status.
  let locationContext: string | null = null;
  if (inp.candidateLocation && jd.location) locationContext = `${inp.candidateLocation} · role: ${jd.location}`;

  // Fallback: too thin to assert anything → caller shows the cover letter instead.
  const fallback = total < 1;

  return { lines, matched, total, yearsContext, locationContext, summary: null, rejected, fallback };
}
