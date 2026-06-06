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
  candidateCv?: string;   // résumé text — needed to check hard disqualifiers (education etc.)
};
export type Gate = {
  profession: 'exact' | 'adjacent' | 'different';
  reason: string;
  language_ok: boolean;
  location_ok: boolean;
  seniority_ok: boolean;
  english_req: 'strong' | 'weak' | 'none';
  // Hard, binary, checkable disqualifier the candidate clearly FAILS (education/license/etc.).
  hard_fail: boolean;
  hard_kind: 'education' | 'certification' | 'license' | 'work_auth' | 'years' | 'native_language' | 'none';
  hard_detail: string;
  // Soft geographic mismatch: job tied to a city/country, remote not explicit, candidate elsewhere.
  location_flag: boolean;
  location_detail: string;
};

const SYSTEM = `You apply on a candidate's behalf — applying burns quota and emails a real recruiter, so be STRICT. Return ONLY JSON:
{"profession":"exact|adjacent|different","reason":"<=8 words","language_ok":bool,"location_ok":bool,"seniority_ok":bool,"english_req":"strong|weak|none","hard_fail":bool,"hard_kind":"education|certification|license|work_auth|years|native_language|none","hard_detail":"<=14 words","location_flag":bool,"location_detail":"<=12 words"}
- profession: "exact"=the candidate's own occupation IS this job's occupation. "adjacent"=same family/transferable but a different specialization (Backend↔Java/AWS Engineer; Full-Stack↔Frontend; Motion Designer↔Video Editor). "different"=different profession family. Merely SPEAKING a language is NOT being a translator; treat translation/interpreting/localization/subtitling as ONE family.
- CROSS-DISCIPLINE — shared programming languages do NOT make two crafts the same profession. Software DEVELOPMENT (building apps) and QUALITY/TEST engineering (SDET, QA Automation, Test Engineer — the craft is VERIFYING software) are DIFFERENT professions: a developer whose résumé shows no real test-automation/QA work applying to an SDET/QA role is "different" (and a QA→pure-dev role likewise). Only "exact"/"adjacent" when the candidate's actual day-job IS that discipline. Same logic for a building-developer ↔ a pure design/visual role.
- CRITICAL — a tool or a title is not a profession: using a design TOOL (Figma, Canva, Sketch) or having "UX/UI" in a developer's title does NOT make a software developer a graphic/visual/email/brand designer — that craft is evidenced by real visual-design work/portfolio. Developer→visual/graphic/email-design role => "different". Designer→software-engineering role => "different".
- language_ok: about the LANGUAGE PAIR ONLY. For translation/interpreting roles, false ONLY if the candidate clearly works in different languages than needed; true otherwise and for non-language roles. Do NOT use this for native-speaker fitness — that is hard_fail/native_language below.
- location_ok: This is a global REMOTE-FREELANCE platform — geography is NOT a blocker. KEYWORD-GATED, do not infer: set location_ok=FALSE ONLY if the post literally contains one of these on-site/work-auth signals — "on-site"/"onsite", "in-office"/"in office", "in person"/"in-person", "relocate"/"relocation", "must reside"/"must live in", "local candidates", "hybrid", "authorized to work in", "work authorization", "citizens only", "no visa sponsorship", "security clearance" — AND the candidate is clearly elsewhere/ineligible. If NONE of those exact signals appears, location_ok=TRUE — EVEN IF a city/state/country is named ("join our team in Charlotte, NC", "based in <city>", "<role> in <city>" are NOT on-site). Naming where the company is ≠ requiring presence. The geography gap still surfaces as a caveat via location_flag; it is NEVER a blocker on its own.
- seniority_ok: false ONLY if job needs 5+ years and candidate is a student/intern/0-1y.
- english_req: "strong" ONLY if English is literally the work product/medium (customer support, sales/account mgmt, content/copywriting/editing in English, teaching English, client-facing comms as core duty) OR an explicit "fluent/native/excellent English required". "weak"=technical/build/design role where English merely helps. "none"=no English signal. When unsure between strong/weak, choose "weak".
- hard_fail: true ONLY if the requirements state an EXPLICIT, binary, checkable must-have that the candidate CLEARLY does not meet — a specific university/school or required degree/major, a mandatory certification/license, work authorization/citizenship, an explicit "minimum N years", or an explicit NATIVE/mother-tongue language the candidate clearly lacks. Set hard_kind + a short hard_detail. Do NOT flag skills (handled by profession/overlap), nor vague/aspirational wording ("preferred", "nice to have", "bonus"). If none clearly fails, hard_fail=false, hard_kind="none".
- YEARS hard_fail (hard_kind="years"): set true ONLY when the post states an EXPLICIT minimum NUMBER of years (e.g. "5+ years required") AND the candidate is clearly below it. A seniority WORD alone — "Senior", "Lead", "Principal" in the title or body with no stated number — is NOT a years hard_fail (hard_fail=false). If you find yourself writing "not explicitly stated" / "likely requires more", that means hard_fail=false.
- native_language: use hard_kind="native_language" when the post EXPLICITLY requires a NATIVE / mother-tongue speaker of a language (e.g. "native English speaker", "mother-tongue German") AND the candidate is CLEARLY not native in it — they merely TEACH/translate/learned it as a second language, or their own background points to a different native tongue. Be strict and asymmetric: if nativeness is plausible or merely unstated, hard_fail=false. (This is separate from language_ok, which is only about the language PAIR.)
- location_flag: SOFT geographic-fit signal (NOT a blocker). true when the job is tied to a specific city/country AND the post does NOT explicitly say remote/worldwide AND the candidate is in a DIFFERENT country — i.e. on-site vs remote is unclear and there's a geography/market gap worth a human glance. location_detail = "job: <city/country>; candidate: <country>". If the job is clearly remote/worldwide, or location is unknown, or candidate is in the same country, location_flag=false.`;

export async function runGate(inp: GateInput): Promise<Gate> {
  const user = `JOB title: ${inp.jobTitle}\nJOB country: ${inp.jobCountry || 'not specified'}\nJOB description: ${(inp.jobDescription || '').slice(0, 700)}\n\nCANDIDATE title: ${inp.candidateTitle || '?'}\nCANDIDATE field: ${inp.candidateField || '?'}\nCANDIDATE years: ${inp.candidateYears ?? '?'}\nCANDIDATE location: ${inp.candidateLocation || 'unknown'}\nCANDIDATE languages: ${(inp.candidateLanguages || []).join(', ') || '?'}\nCANDIDATE skills: ${(inp.candidateSkills || []).join(', ')}\nCANDIDATE résumé (for education/cert/work-auth checks): ${(inp.candidateCv || '').slice(0, 900)}`;
  const r = await zai().chat.completions.create({
    model: MODEL, temperature: 0, max_tokens: 220,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
  });
  const m = (r.choices[0]?.message?.content || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('gate: no JSON');
  const p = JSON.parse(m[0]);
  let hardFail = p.hard_fail === true;
  let hardKind = ['education', 'certification', 'license', 'work_auth', 'years', 'native_language'].includes(p.hard_kind) ? p.hard_kind : 'none';
  let hardDetail = String(p.hard_detail || '');
  // Deterministic YEARS guard: the LLM keeps flagging a years hard_fail even when the candidate
  // MEETS the range (e.g. "requires 6-10, candidate has 7 — this meets the requirement"). Trust
  // the wording / the number, not the flag. Clear the fail when the detail itself says the
  // candidate qualifies, or when the candidate's known years are not below the stated minimum.
  if (hardFail && hardKind === 'years') {
    const meets = /\b(meets?|satisf(?:y|ies)|qualif(?:y|ies)|within|exceeds?|enough|sufficient|not? below|above)\b/i.test(hardDetail);
    let below = false;
    const reqMin = (hardDetail.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:-\s*\d+\s*)?years?/i) || [])[1];
    if (inp.candidateYears != null && reqMin != null) below = inp.candidateYears < parseFloat(reqMin);
    if (meets || !below) { hardFail = false; hardKind = 'none'; hardDetail = ''; }
  }
  // Deterministic WORK-AUTH guard: the LLM keeps inferring a work-auth hard_fail from "the job is in
  // the US" alone (no explicit text). Only honor it when the JD literally states a work-authorization
  // / citizenship / clearance requirement; otherwise it's the same geography over-block via another
  // channel — clear it (the geography gap still surfaces as a location caveat).
  if (hardFail && hardKind === 'work_auth' &&
      !/\b(authoriz\w* to work|work authoriz\w*|citizens? only|citizenship|visa|green card|security clearance|eligible to work|right to work|no sponsorship)\b/i.test(inp.jobDescription || '')) {
    hardFail = false; hardKind = 'none'; hardDetail = '';
  }
  // Deterministic LOCATION guard (global remote-freelance platform): location only BLOCKS when the
  // JD literally states an on-site / work-authorization requirement. The LLM keeps reading "join our
  // team in <city>" as on-site, so we don't trust its location_ok — if the JD text contains NO
  // on-site/work-auth signal, location never blocks (the geography gap survives only as a caveat via
  // location_flag). With a signal present, defer to the LLM's call (it weighs candidate eligibility).
  const ONSITE_RE = /\b(on-?site|in[\s-]?office|in[\s-]?person|relocat\w*|must reside|must live in|local candidates|hybrid|authoriz\w* to work in|work authoriz\w*|citizens? only|no visa sponsorship|security clearance)\b/i;
  const onsiteSignal = ONSITE_RE.test(inp.jobDescription || '');
  const locationOk = onsiteSignal ? (p.location_ok !== false) : true;
  return {
    profession: p.profession === 'exact' || p.profession === 'adjacent' ? p.profession : p.profession === 'different' ? 'different' : 'adjacent',
    reason: String(p.reason || ''),
    language_ok: p.language_ok !== false,
    location_ok: locationOk,
    seniority_ok: p.seniority_ok !== false,
    english_req: p.english_req === 'strong' || p.english_req === 'none' ? p.english_req : 'weak',
    hard_fail: hardFail,
    hard_kind: hardKind,
    hard_detail: hardDetail,
    location_flag: p.location_flag === true,
    location_detail: String(p.location_detail || ''),
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
// require a REAL CV, and cut the weakest — zero skill evidence, an adjacent profession with
// fewer than 2 matched skills, a MISSING CORE (role-defining) requirement, or a below-floor ratio
// (≥3 reqs and <40% matched). The last two close the "1/5 send" hole: at that overlap there's
// nothing honest to write, so the cover would have to fabricate — don't send, don't generate it.
export function assess(
  g: Gate,
  breakdown: { matched: number; total: number; missingCore?: number; coreMatched?: number },
  cvText: string | null | undefined,
  title: string,
  candidateHasRealCV: boolean,
): {
  decision: 'NO' | 'SEND';
  reason: string;
  extras: { profession: Gate['profession']; english_req: Gate['english_req']; english_level: ReturnType<typeof englishLevel>; hard_fail: boolean; hard_kind: Gate['hard_kind']; hard_detail: string; location_flag: boolean; location_detail: string };
} {
  const english_level = englishLevel(cvText);
  const extras = { profession: g.profession, english_req: g.english_req, english_level, hard_fail: g.hard_fail, hard_kind: g.hard_kind, hard_detail: g.hard_detail, location_flag: g.location_flag, location_detail: g.location_detail };
  // Hard gates
  if (g.profession === 'different') return { decision: 'NO', reason: `different profession (${g.reason})`, extras };
  // Language gate applies ONLY to translation/interpreting roles — for any other role the
  // candidate's spoken languages are irrelevant and must never block (the LLM over-flags this).
  if (isLanguageRole(title) && !g.language_ok) return { decision: 'NO', reason: 'wrong language pair', extras };
  if (!g.location_ok) return { decision: 'NO', reason: 'on-site / work-auth required', extras };
  if (!g.seniority_ok) return { decision: 'NO', reason: 'seniority mismatch', extras };
  // Real CV required — NEVER send an application without a real, user-uploaded résumé. A
  // generated/fabricated or missing CV is a hard block (owner decision 2026-06-06): no LinkedIn
  // fallback, no cover-letter-only send. Only a genuine upload (resumeUrl set & not resumeGenerated)
  // is allowed past this point.
  if (!candidateHasRealCV) return { decision: 'NO', reason: 'no real CV (generated/none)', extras };
  // Hard disqualifier: binary, non-negotiable ones (license / work-auth / native-language) → NO.
  // For a "native X required" role a clear non-native is a real fail (cultural adaptation, tone) —
  // sending burns quota and annoys the recruiter. Education/years/cert → SEND but flagged as a
  // severe caveat (see computeCaveats) so the recruiter/owner judges.
  if (g.hard_fail && (g.hard_kind === 'license' || g.hard_kind === 'work_auth' || g.hard_kind === 'native_language'))
    return { decision: 'NO', reason: `hard requirement failed: ${g.hard_kind} (${g.hard_detail})`, extras };
  // Raised evidence bar
  const { matched, total, missingCore, coreMatched } = breakdown;
  if (total === 0) return g.profession === 'exact' ? { decision: 'SEND', reason: 'exact occupation, no listed requirements', extras } : { decision: 'NO', reason: 'no requirements + not exact occupation', extras };
  if (matched === 0) return { decision: 'NO', reason: 'zero skill evidence', extras };
  // Missing a CORE (role-defining) requirement → not a real candidate for this role; an honest cover
  // has no substance to stand on, so DON'T send and DON'T generate one. By this point the breakdown
  // has already passed the semantic backstop (promoteSemanticMatches) — so a core that is STILL
  // missing is a GENUINE gap (the skill is truly absent, not just named differently), not a lexical
  // miss. No exact-occupation leniency here: lacking a role-defining feature = a Weak we skip.
  // `coreMatched` retained for callers/telemetry.
  void coreMatched;
  if (missingCore && missingCore > 0) return { decision: 'NO', reason: 'missing core requirement', extras };
  // Below-floor overlap: with 3+ requirements and under 40% matched, the application is noise.
  if (total >= 3 && matched / total < 0.4) return { decision: 'NO', reason: `below match floor (${matched}/${total})`, extras };
  if (g.profession === 'adjacent' && matched < 2) return { decision: 'NO', reason: 'adjacent + fewer than 2 matched skills', extras };
  return { decision: 'SEND', reason: 'sent with caveats', extras };
}
