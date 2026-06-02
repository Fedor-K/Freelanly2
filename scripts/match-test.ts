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
// Калибровано на реальных прогонах через z.ai (tech/translation/design/marketing):
//  • total≥3 требований → жёсткий порог matched≥K, ratio≥R (режет «1 навык из 5»).
//  • total≤2 → решают ГЕЙТЫ (профессия/язык/локация/сениорность); доказательства не гейтят,
//    иначе идеальный по профессии кандидат отсекается из-за одного отсутствующего тула
//    (наблюдалось: Social Media Manager отклонён от Social-Media роли из-за «video editing»).
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

// ── L2: жёсткие гейты (профессия / язык / локация / сениорность), один LLM-вызов ──
type Gates = { profession_ok: boolean; profession_reason: string; language_ok: boolean; location_ok: boolean; seniority_ok: boolean };
async function gateCheck(listing: any, cand: any): Promise<Gates> {
  return chatJSON(
    `You apply on a candidate's behalf — applying burns quota and emails a real recruiter, so be STRICT. Return ONLY JSON:
{"profession_ok":bool,"profession_reason":"<=12 words","language_ok":bool,"location_ok":bool,"seniority_ok":bool}
- profession_ok=false if the candidate practices a DIFFERENT profession family from the job. Merely SPEAKING a language is NOT being a translator/interpreter. Treat translation/interpreting/localization/subtitling as ONE family.
- language_ok: for translation/interpreting roles, false ONLY if the candidate clearly works in different languages than the job needs; true otherwise and for non-language roles.
- location_ok: false ONLY if job is onsite/hybrid in a specific country AND the candidate is clearly elsewhere. Remote, or unknown country/location => true.
- seniority_ok: false ONLY if job needs 5+ years and candidate is a student/intern/0-1y.`,
    `JOB title: ${listing.title}\nJOB country: ${listing.country || 'not specified'}\nJOB description: ${(listing.description || '').slice(0, 600)}\n\nCANDIDATE title: ${cand.title || '?'}\nCANDIDATE field: ${cand.field || '?'}\nCANDIDATE years: ${cand.years ?? '?'}\nCANDIDATE location: ${cand.location || 'unknown'}\nCANDIDATE languages: ${(cand.languages || []).join(', ') || '?'}\nCANDIDATE skills: ${(cand.skills || []).join(', ')}`,
    250,
  );
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

// ── одна пара: гейты + доказательства + решение ─────────────────────────────────
async function evaluate(listing: any, jd: ParsedJD, cand: any) {
  const gates = await gateCheck(listing, cand);
  const gatesPass = gates.profession_ok && gates.language_ok && gates.location_ok && gates.seniority_ok;
  const bd = buildBreakdown(jd, {
    jdText: `${listing.title}\n${listing.description || ''}`, cvText: cand.cvText,
    candidateSkills: cand.skills, candidateLanguages: cand.languages,
    candidateYears: cand.years, candidateLocation: cand.location,
  });
  const ratio = bd.total ? bd.matched / bd.total : 0;
  // Жёсткий порог доказательств — только когда вакансия дала ≥3 конкретных требования.
  // При total≤2 решают гейты; доказательства лишь ранжируют (см. калибровку у K/R выше).
  const evidenceOk = bd.total >= 3 ? (bd.matched >= K && ratio >= R) : true;
  const apply = gatesPass && evidenceOk;
  return { gates, gatesPass, bd, ratio, apply };
}

function printVerdict(cand: any, r: any) {
  const g = r.gates;
  const gLine = `profession=${g.profession_ok ? 'PASS' : 'FAIL'}${g.profession_ok ? '' : ` (${g.profession_reason})`} | language=${g.language_ok ? 'PASS' : 'FAIL'} | location=${g.location_ok ? 'PASS' : 'FAIL'} | seniority=${g.seniority_ok ? 'PASS' : 'FAIL'}`;
  const ev = r.bd.lines.map((l: any) => `${l.label}${l.status === 'full' ? '✓' : '✗'}`).join(', ');
  console.log(`\n  CANDIDATE  ${cand.email}  "${cand.title}"  (field: ${cand.field || '-'}, ${cand.years ?? '?'}y)`);
  console.log(`    GATES:    ${gLine}`);
  console.log(`    EVIDENCE: ${r.bd.matched}/${r.bd.total} matched  [${ev || '— no parseable requirements —'}]`);
  console.log(`    => ${r.apply ? '✅ MATCH' : '❌ NO-MATCH'}  (ratio ${r.ratio.toFixed(2)}; K=${K} R=${R})`);
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
    let matched = 0;
    for (const c of cands) { const r = await evaluate(listing, jd, c); printVerdict(c, r); if (r.apply) matched++; }
    console.log(`\n  SUMMARY: ${matched}/${cands.length} matched this listing.`);
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
