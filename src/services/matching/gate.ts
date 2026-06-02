// Production matching gate — the validated procedure ported out of scripts/match-test.ts.
// Deterministic gates + profession granularity + working-English signal, decided by z.ai
// (same provider as cover-letter-generator). Pure-ish: one LLM call, no DB, no side effects.
//
// This is the engine intended to replace the per-pair aiMatchCheck. It is SHADOW-SAFE: callers
// can run it alongside the existing matcher and store its output (profession/english_req) into
// matchBreakdown so caveats (src/lib/match-caveats.ts) render on live matches — WITHOUT changing
// any send decision — until parity is confirmed and the cutover flips the decision to assess().
import OpenAI from 'openai';

let _zai: OpenAI | null = null;
function zai(): OpenAI {
  if (!_zai) _zai = new OpenAI({ apiKey: process.env.ZAI_API_KEY || '', baseURL: 'https://api.z.ai/api/paas/v4', timeout: 12000, maxRetries: 1 });
  return _zai;
}
const MODEL = 'glm-4-32b-0414-128k';

export type GateInput = {
  jobTitle: string;
  jobDescription: string;
  jobCountry?: string | null;
  candidateTitle?: string;
  candidateField?: string;
  candidateYears?: number | null;
  candidateLocation?: string;
  candidateLanguages?: string[];
  candidateSkills: string[];
};
export type Gate = {
  profession: 'exact' | 'adjacent' | 'different';
  reason: string;
  language_ok: boolean;
  location_ok: boolean;
  seniority_ok: boolean;
  english_req: 'strong' | 'weak' | 'none';
};

const SYSTEM = `You apply on a candidate's behalf — applying burns quota and emails a real recruiter, so be STRICT. Return ONLY JSON:
{"profession":"exact|adjacent|different","reason":"<=8 words","language_ok":bool,"location_ok":bool,"seniority_ok":bool,"english_req":"strong|weak|none"}
- profession: "exact"=the candidate's own occupation IS this job's occupation. "adjacent"=same family/transferable but a different specialization (Backend↔Java/AWS Engineer; Full-Stack↔Frontend; Motion Designer↔Video Editor). "different"=different profession family. Merely SPEAKING a language is NOT being a translator; treat translation/interpreting/localization/subtitling as ONE family.
- CRITICAL — a tool or a title is not a profession: using a design TOOL (Figma, Canva, Sketch) or having "UX/UI" in a developer's title does NOT make a software developer a graphic/visual/email/brand designer — that craft is evidenced by real visual-design work/portfolio. Developer→visual/graphic/email-design role => "different". Designer→software-engineering role => "different".
- language_ok: for translation/interpreting roles, false ONLY if the candidate clearly works in different languages than needed; true otherwise and for non-language roles.
- location_ok: false ONLY if job is onsite/hybrid in a specific country AND the candidate is clearly elsewhere. Remote/unknown => true.
- seniority_ok: false ONLY if job needs 5+ years and candidate is a student/intern/0-1y.
- english_req: "strong" ONLY if English is literally the work product/medium (customer support, sales/account mgmt, content/copywriting/editing in English, teaching English, client-facing comms as core duty) OR an explicit "fluent/native/excellent English required". "weak"=technical/build/design role where English merely helps. "none"=no English signal. When unsure between strong/weak, choose "weak".`;

export async function runGate(inp: GateInput): Promise<Gate> {
  const user = `JOB title: ${inp.jobTitle}\nJOB country: ${inp.jobCountry || 'not specified'}\nJOB description: ${(inp.jobDescription || '').slice(0, 600)}\n\nCANDIDATE title: ${inp.candidateTitle || '?'}\nCANDIDATE field: ${inp.candidateField || '?'}\nCANDIDATE years: ${inp.candidateYears ?? '?'}\nCANDIDATE location: ${inp.candidateLocation || 'unknown'}\nCANDIDATE languages: ${(inp.candidateLanguages || []).join(', ') || '?'}\nCANDIDATE skills: ${(inp.candidateSkills || []).join(', ')}`;
  const r = await zai().chat.completions.create({
    model: MODEL, temperature: 0, max_tokens: 220,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
  });
  const m = (r.choices[0]?.message?.content || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('gate: no JSON');
  const p = JSON.parse(m[0]);
  return {
    profession: p.profession === 'exact' || p.profession === 'adjacent' ? p.profession : p.profession === 'different' ? 'different' : 'adjacent',
    reason: String(p.reason || ''),
    language_ok: p.language_ok !== false,
    location_ok: p.location_ok !== false,
    seniority_ok: p.seniority_ok !== false,
    english_req: p.english_req === 'strong' || p.english_req === 'none' ? p.english_req : 'weak',
  };
}

// Deterministic English level from CV text (only ~26% state it; rest -> 'unknown').
const ENG_OK = /(english|ingl[eé]s)[^.\n]{0,25}(b2|c1|c2|fluent|fluid|advanced|avanzad|native|nativ|bilingual|biling[üu]e|proficient|full professional)|(b2|c1|c2|fluent|advanced|native|bilingual|proficient)[^.\n]{0,25}(english|ingl[eé]s)/i;
const ENG_B1 = /(english|ingl[eé]s)[^.\n]{0,25}(b1|intermediate|intermedi|pre-intermediate)|(b1|intermediate|intermedi)[^.\n]{0,18}(english|ingl[eé]s)/i;
const ENG_LOW = /(english|ingl[eé]s)[^.\n]{0,25}(a1|a2|basic|b[aá]sic|elementary)|(a1|a2|basic|elementary)[^.\n]{0,18}(english|ingl[eé]s)/i;
export function englishLevel(cv: string | null | undefined): 'ok' | 'b1' | 'low' | 'unknown' {
  if (!cv) return 'unknown';
  if (ENG_OK.test(cv)) return 'ok';
  if (ENG_B1.test(cv)) return 'b1';
  if (ENG_LOW.test(cv)) return 'low';
  return 'unknown';
}
export const isLanguageRole = (title: string) => /interpret|translat|linguist/i.test(title || '');

// Final decision: NO (gate fail / below bar) | SEND. Soft signals that survive the bar become
// caveats (computeCaveats), not blockers — the recruiter is the judge. Bar (per owner decision):
// require a REAL CV, and cut the weakest — zero skill evidence, or an adjacent profession with
// fewer than 2 matched skills. Keeps Strong/Good + light Weak.
export function assess(
  g: Gate,
  breakdown: { matched: number; total: number },
  cvText: string | null | undefined,
  title: string,
  candidateHasRealCV: boolean,
): {
  decision: 'NO' | 'SEND';
  reason: string;
  extras: { profession: Gate['profession']; english_req: Gate['english_req']; english_level: ReturnType<typeof englishLevel> };
} {
  const english_level = englishLevel(cvText);
  const extras = { profession: g.profession, english_req: g.english_req, english_level };
  // Hard gates
  if (g.profession === 'different') return { decision: 'NO', reason: `different profession (${g.reason})`, extras };
  if (!g.language_ok) return { decision: 'NO', reason: 'wrong language pair', extras };
  if (!g.location_ok) return { decision: 'NO', reason: 'location mismatch', extras };
  if (!g.seniority_ok) return { decision: 'NO', reason: 'seniority mismatch', extras };
  // Real CV required — never send a generated/fabricated or missing résumé to a recruiter.
  if (!candidateHasRealCV) return { decision: 'NO', reason: 'no real CV (generated/none)', extras };
  // Raised evidence bar
  const { matched, total } = breakdown;
  if (total === 0) return g.profession === 'exact' ? { decision: 'SEND', reason: 'exact occupation, no listed requirements', extras } : { decision: 'NO', reason: 'no requirements + not exact occupation', extras };
  if (matched === 0) return { decision: 'NO', reason: 'zero skill evidence', extras };
  if (g.profession === 'adjacent' && matched < 2) return { decision: 'NO', reason: 'adjacent + fewer than 2 matched skills', extras };
  return { decision: 'SEND', reason: 'sent with caveats', extras };
}
