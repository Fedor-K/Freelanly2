// Offline eval harness for the recruiter match breakdown. THREE passes:
//   A) DISTRIBUTION — matched-ratio per send (free matcher-accuracy proxy). Valid ONLY if
//      false-neg (Pass C) is low, else it slanders the matcher with breakdown under-credit.
//   B) MINES (false-POS gate) — targeted alias/short-token sends; suspect = full lines matched
//      via alias OR whose matched MEMBER is short/ambiguous (not the display label — that was a bug).
//   C) FALSE-NEG audit — "missing" lines re-checked with a LOOSER (substring) probe; if a
//      requirement's term is loosely present in the CV but the strict judge said missing, it's a
//      suspected breakdown false-neg (over-strict verifier / over-atomization / any-of gap).
// Run on the worker: npx tsx scripts/eval-match-breakdown.ts [distN] [mineN]
import { PrismaClient } from '@prisma/client';
import { generateBreakdown } from '../src/lib/match-breakdown/generate';

const prisma = new PrismaClient();
const DIST_N = parseInt(process.argv[2] || '60', 10);
const MINE_N = parseInt(process.argv[3] || '40', 10);
const SHORT = new Set(['go', 'r', 'c', 'd', 'js', 'ts', 'ai', 'ml', 'qa', 'bi', 'c#', 'c++']);
const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(String) : []);

// Token set for the Pass C probe: each token + a punctuation-stripped form (node.js→nodejs,
// ci/cd→cicd). Used for TOKEN-equality, NOT substring — so java⊄javascript noise is killed,
// while real punctuation-variant alias gaps stay visible.
function tokSet(text: string): Set<string> {
  const norm = (text || '').toLowerCase().replace(/[^a-z0-9+#./\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const set = new Set<string>();
  for (const t of norm.split(' ')) { if (!t) continue; set.add(t); set.add(t.replace(/[.\-/]/g, '')); }
  return set;
}
// looser than the strict judge (catches alias-map GAPS) but still token-boundary, never substring.
function looseHit(members: string[], cvTokens: Set<string>): string | null {
  for (const s of members) {
    const m = s.toLowerCase().trim();
    if (m.length < 4 || SHORT.has(m)) continue;           // short stratum is unmeasured by policy
    if (cvTokens.has(m) || cvTokens.has(m.replace(/[.\-/]/g, ''))) return s;
  }
  return null;
}

function span(text: string, needle: string): string {
  if (!text || !needle) return '∅';
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i === -1) return '∅ (alias/variant — not literal)';
  const s = Math.max(0, i - 35), e = Math.min(text.length, i + needle.length + 35);
  return (s > 0 ? '…' : '') + text.slice(s, e).replace(/\s+/g, ' ').trim() + (e < text.length ? '…' : '');
}

async function load(ids: string[]) {
  const apps = await prisma.autoApplication.findMany({
    where: { id: { in: ids } },
    select: { id: true, jobTitle: true, opportunityId: true, appliedToEmail: true,
      user: { select: { name: true, resumeText: true, parsedProfile: true } } },
  });
  const opps = await prisma.opportunity.findMany({ where: { id: { in: apps.map((a) => a.opportunityId!).filter(Boolean) } }, select: { id: true, description: true, title: true } });
  const om = new Map(opps.map((o) => [o.id, o]));
  return apps.map((a) => ({ a, opp: om.get(a.opportunityId!) }));
}
async function run(app: any, opp: any) {
  const jd = `${opp?.title || app.jobTitle || ''}\n${opp?.description || ''}`;
  const pp = (app.user.parsedProfile || {}) as Record<string, unknown>;
  const cv = (app.user.resumeText as string) || '';
  if (!jd.trim() || !cv.trim()) return null;
  const bd = await generateBreakdown({ jdText: jd, cvText: cv, candidateSkills: arr(pp.skills), candidateLanguages: arr(pp.languages),
    candidateYears: typeof pp.experience_years === 'number' ? pp.experience_years : null, candidateLocation: typeof pp.location === 'string' ? pp.location : null });
  return { bd, jd, cv, pp };
}

async function main() {
  // ---------- PASS A: distribution + collect missing lines for Pass C ----------
  const distApps = await prisma.autoApplication.findMany({ where: { sentAt: { not: null }, opportunityId: { not: null } }, orderBy: { sentAt: 'desc' }, take: DIST_N, select: { id: true } });
  const distRows = await load(distApps.map((a) => a.id));
  const ratios: number[] = []; let dThin = 0;
  const missingRecs: { name: string; job: string; label: string; searched: string[]; cv: string; skills: string[] }[] = [];
  for (const { a, opp } of distRows) {
    const r = await run(a, opp); if (!r) continue;
    if (r.bd.fallback || r.bd.total === 0) { dThin++; continue; }
    ratios.push(r.bd.matched / r.bd.total);
    for (const l of r.bd.lines) if (l.status === 'missing') missingRecs.push({ name: a.user.name || '?', job: a.jobTitle || '?', label: l.label, searched: l.searched || [l.label], cv: r.cv, skills: arr(r.pp.skills) });
  }
  ratios.sort((x, y) => x - y);
  const median = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 0;
  const bk = (lo: number, hi: number) => ratios.filter((r) => r >= lo && r < hi).length;
  console.log('\n══════ PASS A — MATCHED-RATIO DISTRIBUTION (matcher proxy; valid only if Pass C low) ══════');
  console.log(`  оценено: ${ratios.length} | тонких(fallback): ${dThin}`);
  console.log(`  медиана matched-ratio: ${(median * 100).toFixed(0)}%  (missing ≈ ${(100 - median * 100).toFixed(0)}%)`);
  console.log(`  гистограмма: 0%=${ratios.filter((r) => r === 0).length} 1-25%=${bk(0.001, 0.25)} 26-50%=${bk(0.25, 0.5)} 51-75%=${bk(0.5, 0.75)} 76-99%=${bk(0.75, 1)} 100%=${ratios.filter((r) => r === 1).length}`);

  // ---------- PASS C: false-neg audit (looser probe on missing lines) ----------
  console.log('\n══════ PASS C — FALSE-NEG AUDIT (missing lines loosely re-found in CV → suspect) ══════');
  let suspected = 0;
  for (const m of missingRecs) {
    const hitMember = looseHit(m.searched, tokSet(`${m.cv} ${m.skills.join(' ')}`));
    if (hitMember) {
      suspected++;
      console.log(`  ⚠️ «${m.label}» помечен MISSING, но в CV есть токен «${hitMember}» → ${m.name} / ${m.job}`);
      console.log(`     CV: ${span(m.cv + ' ' + m.skills.join(', '), hitMember)}`);
    }
  }
  console.log(`  suspected false-neg (token-boundary, верхняя граница): ${suspected} из ${missingRecs.length} missing-строк  (${missingRecs.length ? (100 * suspected / missingRecs.length).toFixed(0) : 0}%)`);
  console.log('  ↑ это WORKLIST, не метрика. Классифицируй каждый: alias-пробел (вариант есть → чинить алиас-карту, НЕ substring) / verifier прав (игнор) / реальный промах.');
  console.log('  NB: short/ambiguous члены (Go/R/C…) Pass C НЕ меряет (политика «на коротких принимаем false-neg») — страта не измерена, а не доказанно чиста.');

  // ---------- PASS B: mines (false-POS gate) — suspect filter on MEMBER, not display ----------
  const MINE = ['k8s', 'restful', 'postgres', 'node.js', 'nodejs', 'golang', ' go ', 'c++', 'c#', ' r,', 'react.js'];
  const ors = MINE.map((m) => `(lower(o.description) LIKE '%${m}%' OR lower(u."resumeText") LIKE '%${m}%')`).join(' OR ');
  const mineRowsRaw = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT a.id FROM "AutoApplication" a JOIN "Opportunity" o ON o.id=a."opportunityId" JOIN "User" u ON u.id=a."userId" WHERE a."sentAt" IS NOT NULL AND (${ors}) ORDER BY a."sentAt" DESC LIMIT ${MINE_N}`);
  const mineRows = await load(mineRowsRaw.map((r) => r.id));
  console.log(`\n══════ PASS B — MINE STRATA (false-POS gate) — ${mineRows.length} sends, suspect lines only ══════`);
  let aliasLines = 0, shortLines = 0;
  for (const { a, opp } of mineRows) {
    const r = await run(a, opp); if (!r) continue;
    const suspect = r.bd.lines.filter((l) => l.status === 'full' && (l.viaAlias || SHORT.has((l.member || '').toLowerCase()) || SHORT.has((l.evidence || '').toLowerCase())));
    if (!suspect.length) continue;
    console.log(`\n— ${a.user.name || 'Candidate'} → «${a.jobTitle}» (${a.appliedToEmail})`);
    for (const l of suspect) {
      const isShort = SHORT.has((l.member || '').toLowerCase()) || SHORT.has((l.evidence || '').toLowerCase());
      if (l.viaAlias) aliasLines++; if (isShort) shortLines++;
      console.log(`  ✅ «${l.label}» member=${l.member} ${l.viaAlias ? '🔶ALIAS→' + l.evidence : ''} ${isShort ? '🔻SHORT' : ''}`);
      console.log(`     JD: ${span(r.jd, l.member || l.label)}`);
      console.log(`     CV: ${span(r.cv + ' ' + arr(r.pp.skills).join(', '), l.evidence || l.member || l.label)}`);
    }
  }
  console.log(`\n  страта: alias-matched=${aliasLines} | short-token=${shortLines}`);
  console.log('  ↑ ГЕЙТ: каждая строка — совпадение JD↔CV настоящее? 0 false-pos = верификатор к проду готов.');
}
main().catch((e) => { console.error('ERR', e); process.exit(1); }).finally(() => prisma.$disconnect());
