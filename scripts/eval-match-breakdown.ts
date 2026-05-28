// Offline eval harness for the recruiter match breakdown. Two passes:
//   A) DISTRIBUTION — matched-ratio per send over a representative sample = a free proxy for
//      matcher accuracy (high missing-rate ⇒ matcher sends junk, fix targeting before render).
//   B) MINES — targeted pull of sends whose JD/CV contain alias pairs (k8s/restful/postgres…)
//      or short/ambiguous tokens (go/c#/c++…); prints triple-trace focused on those suspect
//      lines for the false-positive gate (random samples leave these strata empty).
// Run on the worker (AI keys + DB): npx tsx scripts/eval-match-breakdown.ts [distN] [mineN]
import { PrismaClient } from '@prisma/client';
import { generateBreakdown } from '../src/lib/match-breakdown/generate';

const prisma = new PrismaClient();
const DIST_N = parseInt(process.argv[2] || '60', 10);
const MINE_N = parseInt(process.argv[3] || '40', 10);

function span(text: string, needle: string): string {
  if (!text || !needle) return '∅';
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i === -1) return '∅ (alias/variant — not literal)';
  const s = Math.max(0, i - 35), e = Math.min(text.length, i + needle.length + 35);
  return (s > 0 ? '…' : '') + text.slice(s, e).replace(/\s+/g, ' ').trim() + (e < text.length ? '…' : '');
}

const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(String) : []);

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
  const bd = await generateBreakdown({
    jdText: jd, cvText: cv,
    candidateSkills: arr(pp.skills), candidateLanguages: arr(pp.languages),
    candidateYears: typeof pp.experience_years === 'number' ? pp.experience_years : null,
    candidateLocation: typeof pp.location === 'string' ? pp.location : null,
  });
  return { bd, jd, cv, pp };
}

async function main() {
  // ---------- PASS A: distribution (matcher-accuracy proxy) ----------
  const distApps = await prisma.autoApplication.findMany({
    where: { sentAt: { not: null }, opportunityId: { not: null } },
    orderBy: { sentAt: 'desc' }, take: DIST_N, select: { id: true },
  });
  const distRows = await load(distApps.map((a) => a.id));
  const ratios: number[] = []; let dThin = 0;
  for (const { a, opp } of distRows) {
    const r = await run(a, opp); if (!r) continue;
    if (r.bd.fallback || r.bd.total === 0) { dThin++; continue; }
    ratios.push(r.bd.matched / r.bd.total);
  }
  ratios.sort((x, y) => x - y);
  const median = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 0;
  const bucket = (lo: number, hi: number) => ratios.filter((r) => r >= lo && r < hi).length;
  console.log('\n══════ PASS A — MATCHED-RATIO DISTRIBUTION (matcher-accuracy proxy) ══════');
  console.log(`  оценено: ${ratios.length} | тонких(fallback): ${dThin}`);
  console.log(`  медиана matched-ratio: ${(median * 100).toFixed(0)}%   (missing медиана ≈ ${(100 - median * 100).toFixed(0)}%)`);
  console.log(`  гистограмма matched-ratio:`);
  console.log(`    0%      : ${ratios.filter((r) => r === 0).length}`);
  console.log(`    1-25%   : ${bucket(0.001, 0.25)}`);
  console.log(`    26-50%  : ${bucket(0.25, 0.5)}`);
  console.log(`    51-75%  : ${bucket(0.5, 0.75)}`);
  console.log(`    76-99%  : ${bucket(0.75, 1)}`);
  console.log(`    100%    : ${ratios.filter((r) => r === 1).length}`);

  // ---------- PASS B: targeted mines (false-pos audit strata) ----------
  const MINE = ['k8s', 'restful', 'postgres', 'node.js', 'nodejs', 'golang', ' go ', 'c++', 'c#', ' r,', 'react.js'];
  const ors = MINE.map((m) => `(lower(o.description) LIKE '%${m}%' OR lower(u."resumeText") LIKE '%${m}%')`).join(' OR ');
  const mineRowsRaw = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT a.id FROM "AutoApplication" a JOIN "Opportunity" o ON o.id=a."opportunityId" JOIN "User" u ON u.id=a."userId"
     WHERE a."sentAt" IS NOT NULL AND (${ors}) ORDER BY a."sentAt" DESC LIMIT ${MINE_N}`);
  const mineRows = await load(mineRowsRaw.map((r) => r.id));
  console.log(`\n══════ PASS B — MINE STRATA (alias / short tokens) — ${mineRows.length} sends, suspect lines only ══════`);
  let aliasLines = 0, shortLines = 0;
  const SHORT = new Set(['go', 'r', 'c', 'd', 'js', 'ts', 'ai', 'ml', 'qa', 'bi', 'c#', 'c++']);
  for (const { a, opp } of mineRows) {
    const r = await run(a, opp); if (!r) continue;
    const suspect = r.bd.lines.filter((l) => l.status === 'full' && (l.viaAlias || SHORT.has(l.label.toLowerCase())));
    if (!suspect.length) continue;
    console.log(`\n— ${a.user.name || 'Candidate'} → «${a.jobTitle}» (${a.appliedToEmail})`);
    for (const l of suspect) {
      if (l.viaAlias) aliasLines++; if (SHORT.has(l.label.toLowerCase())) shortLines++;
      console.log(`  ✅ «${l.label}» ${l.viaAlias ? '🔶ALIAS→' + l.evidence : ''} ${SHORT.has(l.label.toLowerCase()) ? '🔻SHORT' : ''}`);
      console.log(`     JD: ${span(r.jd, l.label)}`);
      console.log(`     CV: ${span(r.cv + ' ' + arr(r.pp.skills).join(', '), l.evidence || l.label)}`);
    }
  }
  console.log(`\n  страта alias-matched строк: ${aliasLines} | short-token строк: ${shortLines}`);
  console.log('  ↑ КАЖДУЮ из этих строк проверь глазами: совпадение JD↔CV настоящее? Гейт = 0 false-pos здесь.');
}

main().catch((e) => { console.error('ERR', e); process.exit(1); }).finally(() => prisma.$disconnect());
