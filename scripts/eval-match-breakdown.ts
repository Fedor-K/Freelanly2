// Offline eval harness for the recruiter match breakdown. Runs the engine over historical
// SENT applications and prints a TRIPLE TRACE per line so a human can audit all three
// false-positive surfaces at a glance:
//   requirement → JD-span (is the requirement real? #1) → evidence → CV-span (is it real? #2)
//   → status (does it cover the requirement? #3 — collapsed by token-identity).
// Run on the worker (has AI keys + DB): npx tsx scripts/eval-match-breakdown.ts [N]
import { PrismaClient } from '@prisma/client';
import { generateBreakdown } from '../src/lib/match-breakdown/generate';

const prisma = new PrismaClient();
const N = parseInt(process.argv[2] || '12', 10);

const AMBIG = new Set(['go', 'r', 'c', 'd', 'js', 'ts', 'ai', 'ml', 'qa', 'bi']);

// context window around the first occurrence of `needle` (case-insensitive) in `text`
function span(text: string, needle: string): string {
  if (!text || !needle) return '∅ (not located)';
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i === -1) return '∅ (alias/variant — not literal)';
  const s = Math.max(0, i - 35), e = Math.min(text.length, i + needle.length + 35);
  return (s > 0 ? '…' : '') + text.slice(s, e).replace(/\s+/g, ' ').trim() + (e < text.length ? '…' : '');
}

async function main() {
  const apps = await prisma.autoApplication.findMany({
    where: { sentAt: { not: null }, opportunityId: { not: null } },
    orderBy: { sentAt: 'desc' },
    take: N,
    select: { id: true, jobTitle: true, opportunityId: true, appliedToEmail: true,
      user: { select: { name: true, resumeText: true, parsedProfile: true } } },
  });
  const oppIds = apps.map((a) => a.opportunityId!).filter(Boolean);
  const opps = await prisma.opportunity.findMany({ where: { id: { in: oppIds } }, select: { id: true, description: true, title: true } });
  const oppMap = new Map(opps.map((o) => [o.id, o]));

  let stats = { apps: 0, fallback: 0, lines: 0, full: 0, missing: 0, aliasMatched: 0, shortTok: 0, rejJD: 0, withYears: 0 };

  for (const a of apps) {
    const opp = oppMap.get(a.opportunityId!);
    const jd = `${opp?.title || a.jobTitle || ''}\n${opp?.description || ''}`;
    const pp = (a.user.parsedProfile || {}) as Record<string, unknown>;
    const cv = (a.user.resumeText as string) || '';
    if (!jd.trim() || !cv.trim()) continue;
    const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(String) : []);

    const bd = await generateBreakdown({
      jdText: jd, cvText: cv,
      candidateSkills: arr(pp.skills),
      candidateLanguages: arr(pp.languages),
      candidateYears: typeof pp.experience_years === 'number' ? pp.experience_years : null,
      candidateLocation: typeof pp.location === 'string' ? pp.location : null,
    });

    stats.apps++;
    if (bd.fallback) stats.fallback++;
    if (bd.yearsContext) stats.withYears++;
    stats.rejJD += bd.rejected.length;

    console.log('\n' + '═'.repeat(78));
    console.log(`${a.user.name || 'Candidate'}  →  «${a.jobTitle}»  (${a.appliedToEmail})`);
    console.log(`   X/Y: ${bd.matched}/${bd.total}${bd.fallback ? '   ⚠️ FALLBACK → show cover letter (too thin)' : ''}`);
    if (bd.yearsContext) console.log(`   ~years (soft, no status): ${bd.yearsContext}`);
    if (bd.locationContext) console.log(`   location (soft): ${bd.locationContext}`);
    if (bd.rejected.length) console.log(`   ⊘ rejected (verify-on-JD #1): ${bd.rejected.map((r) => `${r.label}[${r.type}]`).join(', ')}`);

    for (const l of bd.lines) {
      stats.lines++;
      if (l.status === 'full') stats.full++; else stats.missing++;
      const isShort = AMBIG.has(l.label.toLowerCase());
      const isAlias = l.status === 'full' && l.evidence ? l.evidence.toLowerCase() !== l.label.toLowerCase() : false;
      if (isAlias) stats.aliasMatched++;
      if (isShort) stats.shortTok++;
      const flags = [isAlias ? '🔶ALIAS' : '', isShort ? '🔻SHORT' : ''].filter(Boolean).join(' ');
      const icon = l.status === 'full' ? '✅' : '⚪';
      console.log(`   ${icon} [${l.type}] «${l.label}» ${flags}`);
      console.log(`        JD : ${span(jd, l.label)}`);
      if (l.status === 'full') console.log(`        CV : ${span(cv + ' ' + arr(pp.skills).join(', '), l.evidence || l.label)}   (matched: ${l.evidence})`);
      else console.log(`        CV : — not found —`);
    }
  }

  console.log('\n' + '━'.repeat(78));
  console.log('СВОДКА:', JSON.stringify(stats, null, 0));
  console.log(`  fallback rate: ${(100 * stats.fallback / Math.max(1, stats.apps)).toFixed(0)}%`);
  console.log(`  строк всего: ${stats.lines} | full: ${stats.full} | missing: ${stats.missing}`);
  console.log(`  🔶 alias-matched (страта на false-pos аудит): ${stats.aliasMatched}`);
  console.log(`  🔻 short/ambiguous токены (страта): ${stats.shortTok}`);
  console.log(`  ⊘ rejected verify-on-JD #1 (страта/лог): ${stats.rejJD}`);
}

main().catch((e) => { console.error('ERR', e); process.exit(1); }).finally(() => prisma.$disconnect());
