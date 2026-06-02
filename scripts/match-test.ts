/**
 * match-test.ts — запускаемый тест процедуры матчинга «профиль ↔ вакансия».
 *
 * ЧТО ДЕЛАЕТ: берёт реальную вакансию и реальный профиль(и) юзера из БД,
 * прогоняет процедуру (детерминированные гейты + доказательный overlap навыков)
 * и печатает понятный вердикт MATCH / NO-MATCH с причинами. Без ответов рекрутеров,
 * без производных полей — только сырые `Opportunity` и `User.parsedProfile`.
 *
 * ЗАПУСК (локально, где доступны БД и AI-ключ):
 *   npx tsx scripts/match-test.ts                          # демо: случайная вакансия × пул юзеров
 *   npx tsx scripts/match-test.ts <listingId>              # эта вакансия × пул юзеров
 *   npx tsx scripts/match-test.ts <listingId> <userEmail>  # одна пара, подробно
 *
 * ТРЕБУЕТ env: DATABASE_URL  и  ZAI_API_KEY  (провайдер — только z.ai).
 *
 * Пороги (можно переопределить env-ом):
 *   MATCH_MIN_MATCHED (K, по умолчанию 1)   MATCH_MIN_RATIO (R, по умолчанию 0.2)
 */
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { buildBreakdown, type ParsedJD } from '../src/lib/match-breakdown/generate';

const prisma = new PrismaClient();
// Пороги доказательной базы для ADJACENT-профессии при ≥3 требованиях (см. decide()).
// Откалибровано на широких z.ai-прогонах: matched≥K и ratio≥R режут «1 generic-навык из 5».
const K = Number(process.env.MATCH_MIN_MATCHED || 2);
const R = Number(process.env.MATCH_MIN_RATIO || 0.34);

// ── AI client — ТОЛЬКО z.ai (как в проде). Других провайдеров нет. ───────────────
function ai(): { client: OpenAI; model: string } {
  return { client: new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' }), model: 'glm-4-32b-0414-128k' };
}
async function chatJSON(system: string, user: string, maxTokens = 400): Promise<any> {
  const { client, model } = ai();
  const r = await client.chat.completions.create({
    model, temperature: 0, max_tokens: maxTokens,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  });
  const m = (r.choices[0]?.message?.content || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI returned no JSON');
  return JSON.parse(m[0]);
}

// ── L0: разбор требований вакансии из TITLE+DESCRIPTION (не из мусорного skills[]) ─
async function parseListing(title: string, description: string): Promise<ParsedJD> {
  const jd = await chatJSON(
    `Extract ONLY explicit must-have requirements from this job post. Return JSON:
{"skills":[{"display":"string","anyOf":["atomic tool name"]}],"languages":["English"],"years":number|null,"location":"string|null"}
RULES: each skill = ONE concrete tool/tech literally named (SPLIT lists). Max 5, most important first.
"anyOf"=atomic tool names; for "X or equivalent" list real equivalents, else OMIT (never reduce to X).
"languages"=spoken languages only if explicitly required (do NOT add English by default).
"years"=min years if stated else null. "location"=required country/timezone if stated else null.
Do NOT invent requirements. No soft traits (leadership, team player). JSON only.`,
    `${title}\n\n${description}`.slice(0, 4000), 500,
  );
  const skills = (Array.isArray(jd.skills) ? jd.skills : [])
    .map((s: any) => typeof s === 'string'
      ? { display: s, anyOf: [s] }
      : { display: (s.display || (s.anyOf || [])[0] || '').trim(), anyOf: (Array.isArray(s.anyOf) ? s.anyOf : []).map(String).map((x: string) => x.trim()).filter(Boolean).slice(0, 5) })
    .filter((s: any) => s.anyOf.length).slice(0, 5);
  return { skills, languages: (Array.isArray(jd.languages) ? jd.languages : []).map(String), years: typeof jd.years === 'number' ? jd.years : null, location: typeof jd.location === 'string' ? jd.location : null };
}

// ── L2: гейты с ГРАНУЛЯРНОСТЬЮ профессии (exact|adjacent|different) ────────────────
type Gates = { profession: 'exact' | 'adjacent' | 'different'; reason: string; language_ok: boolean; location_ok: boolean; seniority_ok: boolean; english_req: 'strong' | 'weak' | 'none' };
async function gateCheck(listing: any, cand: any): Promise<Gates> {
  return chatJSON(
    `You apply on a candidate's behalf — applying burns quota and emails a real recruiter, so be STRICT. Return ONLY JSON:
{"profession":"exact|adjacent|different","reason":"<=8 words","language_ok":bool,"location_ok":bool,"seniority_ok":bool,"english_req":"strong|weak|none"}
- profession: "exact"=the candidate's own occupation IS this job's occupation (e.g. Social Media Manager↔Social Media Account Manager; Graphic Designer↔Graphic Designer; both translate↔translation role). "adjacent"=same family/transferable but a different specialization (e.g. Backend Developer↔Java/AWS Engineer; Full-Stack↔Frontend; Motion Designer↔Video Editor). "different"=different profession family (developer/marketer/HR↔translator, etc.). Merely SPEAKING a language is NOT being a translator. Treat translation/interpreting/localization/subtitling as ONE family.
- CRITICAL — a tool or a title is not a profession: using a design TOOL (Figma, Canva, Sketch) or having "UX/UI" in a developer's title does NOT make a software developer a graphic/visual/email/brand designer — that craft is evidenced by real visual-design work/portfolio, exactly like merely SPEAKING a language does not make someone a translator. A developer applying to a visual/graphic/email/brand-design role => "different". A designer applying to a software-engineering role => "different".
- language_ok: for translation/interpreting roles, false ONLY if the candidate clearly works in different languages than the job needs; true otherwise and for non-language roles.
- location_ok: false ONLY if job is onsite/hybrid in a specific country AND the candidate is clearly elsewhere. Remote, or unknown country/location => true.
- seniority_ok: false ONLY if job needs 5+ years and candidate is a student/intern/0-1y.
- english_req: how critical is WORKING English? "strong" ONLY if English is literally the work product/medium (customer support, sales/account mgmt, content/copywriting/editing in English, teaching English, client-facing comms as core duty) OR an explicit "fluent/native/excellent English required"/"C1". "weak"=technical/build/design role where English merely helps ("international team","remote","communicate in English"). "none"=no English signal. When unsure between strong/weak, choose "weak".`,
    `JOB title: ${listing.title}\nJOB country: ${listing.country || 'not specified'}\nJOB description: ${(listing.description || '').slice(0, 600)}\n\nCANDIDATE title: ${cand.title || '?'}\nCANDIDATE field: ${cand.field || '?'}\nCANDIDATE years: ${cand.years ?? '?'}\nCANDIDATE location: ${cand.location || 'unknown'}\nCANDIDATE languages: ${(cand.languages || []).join(', ') || '?'}\nCANDIDATE skills: ${(cand.skills || []).join(', ')}`,
    250,
  );
}

// ── Working-English fit (deterministic level from CV; gate only NON-translation roles) ─
const ENG_OK = /(english|ingl[eé]s)[^.\n]{0,25}(b2|c1|c2|fluent|fluid|advanced|avanzad|native|nativ|bilingual|biling[üu]e|proficient|full professional)|(b2|c1|c2|fluent|advanced|native|bilingual|proficient)[^.\n]{0,25}(english|ingl[eé]s)/i;
const ENG_B1 = /(english|ingl[eé]s)[^.\n]{0,25}(b1|intermediate|intermedi|pre-intermediate)|(b1|intermediate|intermedi)[^.\n]{0,18}(english|ingl[eé]s)/i;
const ENG_LOW = /(english|ingl[eé]s)[^.\n]{0,25}(a1|a2|basic|b[aá]sic|elementary)|(a1|a2|basic|elementary)[^.\n]{0,18}(english|ingl[eé]s)/i;
function englishLevel(cv: string): 'ok' | 'b1' | 'low' | 'unknown' {
  if (!cv) return 'unknown';
  if (ENG_OK.test(cv)) return 'ok';
  if (ENG_B1.test(cv)) return 'b1';
  if (ENG_LOW.test(cv)) return 'low';
  return 'unknown';
}
const isLanguageRole = (title: string) => /interpret|translat|linguist/i.test(title || '');
// returns true if a would-be MATCH should drop to REVIEW on working-English risk
function englishDowngrade(req: string, level: string): boolean {
  if (req === 'strong') return level === 'low' || level === 'b1' || level === 'unknown';
  if (req === 'weak') return level === 'low';
  return false; // none / B2+ → no downgrade
}

// ── профиль → нормализованные поля ──────────────────────────────────────────────
function asArr(x: any): string[] { return Array.isArray(x) ? x.map(String) : []; }
function loadCand(u: any) {
  const pp = (u.parsedProfile || {}) as any;
  return {
    email: u.email, title: pp.current_title || '', field: pp.field || '',
    years: pp.experience_years != null ? Number(String(pp.experience_years).replace(/[^0-9.]/g, '')) || 0 : null,
    location: pp.location || '', skills: asArr(pp.skills), languages: asArr(pp.languages),
    cvText: u.resumeText || '',
  };
}

// ── ФИНАЛЬНОЕ правило (откалибровано на широких z.ai-прогонах). 3 исхода. ─────────
// NO     — гейт не прошёл (другая профессия / язык / локация / сениорность).
// MATCH  — авто-отправка. REVIEW — полу-авто (статус AutoApplyStatus.REVIEW), человек глянет.
type Outcome = 'MATCH' | 'REVIEW' | 'NO';
function decide(g: Gates, matched: number, total: number, topFull: boolean): { res: Outcome; why: string } {
  if (g.profession === 'different' || !g.language_ok || !g.location_ok || !g.seniority_ok) return { res: 'NO', why: 'gate' };
  const ratio = total ? matched / total : 0;
  if (g.profession === 'exact') {
    // Занятие кандидата = роль. Но «exact + 1 из 5 навыков» = слишком тонко (стек не тот) → REVIEW.
    // MATCH: нет требований; ≤2 требований и есть хоть одно; ≥3 требований и matched≥K, ratio≥R.
    if (total === 0 || (total <= 2 && matched >= 1) || (total >= 3 && matched >= K && ratio >= R)) return { res: 'MATCH', why: 'exact-occupation' };
    return { res: 'REVIEW', why: 'exact-thin-evidence' };
  }
  // adjacent: нужна доказательная база
  if (total === 0) return { res: 'REVIEW', why: 'adjacent-no-requirements' };   // без требований по профессии — только REVIEW
  // ≤2 требований: MATCH только если совпали ВСЕ (1 из 2 = не хватает специализации → REVIEW, напр. Figma✓ но Email-design✗).
  // ≥3 требований: топ-навык + ≥K совпадений и ratio≥R.
  if (topFull && ((total <= 2 && matched === total) || (total >= 3 && matched >= K && ratio >= R))) return { res: 'MATCH', why: 'adjacent+core-skill' };
  if (matched === 0) return { res: 'NO', why: 'adjacent-wrong-stack' };
  return { res: 'REVIEW', why: 'adjacent-partial' };
}

async function evaluate(listing: any, jd: ParsedJD, cand: any) {
  const gates = await gateCheck(listing, cand);
  const bd = buildBreakdown(jd, {
    jdText: `${listing.title}\n${listing.description || ''}`, cvText: cand.cvText,
    candidateSkills: cand.skills, candidateLanguages: cand.languages,
    candidateYears: cand.years, candidateLocation: cand.location,
  });
  const topFull = bd.lines.length > 0 && bd.lines[0].status === 'full'; // топ-требование (most-important-first)
  const d = decide(gates, bd.matched, bd.total, topFull);
  // Working-English fit: downgrade a MATCH to REVIEW for English-critical NON-translation roles
  // when the candidate has no proven B2+ English (translation roles are handled by language_ok).
  const engLvl = englishLevel(cand.cvText);
  if (d.res === 'MATCH' && !isLanguageRole(listing.title) && englishDowngrade(gates.english_req, engLvl)) {
    return { gates, bd, res: 'REVIEW' as Outcome, why: `language-fit(req=${gates.english_req},eng=${engLvl})` };
  }
  return { gates, bd, ...d };
}

function printVerdict(cand: any, r: any) {
  const g = r.gates;
  const gLine = `profession=${g.profession} | language=${g.language_ok ? 'Y' : 'N'} | location=${g.location_ok ? 'Y' : 'N'} | seniority=${g.seniority_ok ? 'Y' : 'N'} | eng-req=${g.english_req}`;
  const ev = r.bd.lines.map((l: any) => `${l.label}${l.status === 'full' ? '✓' : '✗'}`).join(', ');
  const icon = r.res === 'MATCH' ? '✅ MATCH' : r.res === 'REVIEW' ? '🟡 REVIEW' : '❌ NO';
  console.log(`\n  CANDIDATE  ${cand.email}  "${cand.title}"  (field: ${cand.field || '-'}, ${cand.years ?? '?'}y)`);
  console.log(`    GATES:    ${gLine}${g.profession === 'different' ? `  (${g.reason})` : ''}`);
  console.log(`    EVIDENCE: ${r.bd.matched}/${r.bd.total}  [${ev || '— нет извлечённых требований —'}]`);
  console.log(`    => ${icon}  (${r.why})`);
}

// ── cheap pre-filter (term overlap) — высокий recall, без LLM ────────────────────
function termPlausible(cand: any, haystack: string): boolean {
  const terms = new Set<string>();
  for (const s of cand.skills.slice(0, 8)) { const t = s.toLowerCase().trim(); if (t.length >= 3) terms.add(t); }
  for (const t of (cand.title || '').toLowerCase().split(/[^a-z0-9+#]+/)) if (t.length >= 3) terms.add(t);
  if (terms.size === 0) return true;
  for (const t of terms) if (haystack.includes(t)) return true;
  return false;
}

async function main() {
  const [, , arg1, arg2] = process.argv;
  const listing = arg1
    ? await prisma.opportunity.findUnique({ where: { id: arg1 } })
    : (await prisma.$queryRaw<any[]>`SELECT * FROM "Opportunity" WHERE "isActive"=true AND length(description)>200 ORDER BY random() LIMIT 1`)[0];
  if (!listing) { console.error('Listing not found'); return; }

  console.log('='.repeat(78));
  console.log(`LISTING  ${listing.id}\n  "${listing.title}"  (country: ${listing.country || '-'})`);
  console.log(`  desc: ${(listing.description || '').replace(/\s+/g, ' ').slice(0, 220)}…`);
  const jd = await parseListing(listing.title, listing.description || '');
  console.log(`  parsed requirements: skills=[${jd.skills.map(s => s.display).join(', ') || '—'}] languages=[${jd.languages.join(', ') || '—'}] years=${jd.years ?? '-'}`);

  if (arg2) {
    const u = await prisma.user.findFirst({ where: { OR: [{ email: arg2 }, { id: arg2 }] } });
    if (!u) { console.error('User not found'); return; }
    printVerdict(loadCand(u), await evaluate(listing, jd, loadCand(u)));
  } else {
    // пул кандидатов: 200 случайных юзеров с навыками → term-prefilter → оценить до 10
    const pool = await prisma.$queryRaw<any[]>`SELECT email, "parsedProfile", "resumeText" FROM "User" WHERE jsonb_typeof("parsedProfile"->'skills')='array' ORDER BY random() LIMIT 200`;
    const haystack = `${listing.title} ${listing.description || ''}`.toLowerCase();
    const cands = pool.map(loadCand).filter(c => c.skills.length > 0 && termPlausible(c, haystack)).slice(0, 10);
    console.log(`\n  Evaluating ${cands.length} term-plausible candidates (of ${pool.length} sampled)…`);
    const tally = { MATCH: 0, REVIEW: 0, NO: 0 };
    for (const c of cands) { const r = await evaluate(listing, jd, c); printVerdict(c, r); tally[r.res as 'MATCH' | 'REVIEW' | 'NO']++; }
    console.log(`\n  SUMMARY: MATCH=${tally.MATCH}  REVIEW=${tally.REVIEW}  NO=${tally.NO}  (of ${cands.length})`);
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
