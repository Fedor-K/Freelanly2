// Offline eval harness for the recruiter match breakdown. THREE passes:
//   A) DISTRIBUTION — matched-ratio per send (matcher-accuracy proxy; valid iff Pass C low).
//   C) FALSE-NEG — "missing" lines re-probed token-boundary (worklist, not metric).
//   B) FALSE-POS GATE — EVERY non-exact full line (alias / collapse / short token) across the
//      whole sample (+ targeted mines) with triple-trace. Exact-token matches can't be false-pos,
//      so the suspect set = all non-exact matches. Gate = 0 real false-pos here.
// Run on the worker: npx tsx scripts/eval-match-breakdown.ts [distN] [mineN]
import { PrismaClient } from '@prisma/client';
import { generateBreakdown, type Line } from '../src/lib/match-breakdown/generate';

const prisma = new PrismaClient();
const DIST_N = parseInt(process.argv[2] || '60', 10);
const MINE_N = parseInt(process.argv[3] || '40', 10);
const SHORT = new Set(['go', 'r', 'c', 'd', 'js', 'ts', 'ai', 'ml', 'qa', 'bi', 'c#', 'c++']);
const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(String) : []);
const isShort = (l: Line) => SHORT.has((l.member || '').toLowerCase()) || SHORT.has((l.evidence || '').toLowerCase());
const isSuspect = (l: Line) => l.status === 'full' && (l.viaAlias || l.viaCollapse || isShort(l));

function tokSet(text: string): Set<string> {
  const norm = (text || '').toLowerCase().replace(/[^a-z0-9+#./\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const set = new Set<string>();
  for (const t of norm.split(' ')) { if (!t) continue; set.add(t); set.add(t.replace(/[.\-/]/g, '')); }
  return set;
}
function looseHit(members: string[], cvTokens: Set<string>): string | null {
  for (const s of members) { const m = s.toLowerCase().trim(); if (m.length < 4 || SHORT.has(m)) continue; if (cvTokens.has(m) || cvTokens.has(m.replace(/[.\-/]/g, ''))) return s; }
  return null;
}
function span(text: string, needle: string): string {
  if (!text || !needle) return '∅';
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i !== -1) { const s = Math.max(0, i - 35), e = Math.min(text.length, i + needle.length + 35); return (s > 0 ? '…' : '') + text.slice(s, e).replace(/\s+/g, ' ').trim() + (e < text.length ? '…' : ''); }
  // collapse fallback: locate the token (or adjacent pair) whose collapsed form == collapsed needle
  const cn = needle.toLowerCase().replace(/[.\-/ ]/g, '');
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const clean = (w: string) => w.toLowerCase().replace(/[^a-z0-9+#./\-]/g, '');
  const ctx = (k: number, n: number) => { const s = Math.max(0, k - 6), e = Math.min(words.length, k + n + 6); return '⟦collapse⟧ ' + (s > 0 ? '…' : '') + words.slice(s, e).join(' ') + (e < words.length ? '…' : ''); };
  for (let k = 0; k < words.length; k++) {
    if (clean(words[k]).replace(/[.\-/]/g, '') === cn) return ctx(k, 1);
    if (k + 1 < words.length && (clean(words[k]) + clean(words[k + 1])).replace(/[.\-/]/g, '') === cn) return ctx(k, 2);
  }
  return '∅ (NOT located in CV — investigate)';
}

async function load(ids: string[]) {
  const apps = await prisma.autoApplication.findMany({ where: { id: { in: ids } },
    select: { id: true, jobTitle: true, opportunityId: true, appliedToEmail: true, user: { select: { name: true, resumeText: true, parsedProfile: true } } } });
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

type Susp = { name: string; job: string; email: string; l: Line; jd: string; cv: string; skills: string[]; src: string };

async function main() {
  const ratios: number[] = []; let dThin = 0;
  const missingRecs: { name: string; job: string; label: string; searched: string[]; cv: string; skills: string[] }[] = [];
  const suspects: Susp[] = [];
  const collect = (a: any, r: any, src: string) => {
    for (const l of r.bd.lines as Line[]) {
      if (l.status === 'missing') missingRecs.push({ name: a.user.name || '?', job: a.jobTitle || '?', label: l.label, searched: l.searched || [l.label], cv: r.cv, skills: arr(r.pp.skills) });
      else if (isSuspect(l)) suspects.push({ name: a.user.name || '?', job: a.jobTitle || '?', email: a.appliedToEmail || '?', l, jd: r.jd, cv: r.cv, skills: arr(r.pp.skills), src });
    }
  };

  // PASS A
  const distApps = await prisma.autoApplication.findMany({ where: { sentAt: { not: null }, opportunityId: { not: null } }, orderBy: { sentAt: 'desc' }, take: DIST_N, select: { id: true } });
  for (const { a, opp } of await load(distApps.map((x) => x.id))) {
    const r = await run(a, opp); if (!r) continue;
    if (r.bd.fallback || r.bd.total === 0) { dThin++; collect(a, r, 'dist'); continue; }
    ratios.push(r.bd.matched / r.bd.total); collect(a, r, 'dist');
  }
  ratios.sort((x, y) => x - y);
  const median = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 0;
  const bk = (lo: number, hi: number) => ratios.filter((r) => r >= lo && r < hi).length;
  console.log('\n══════ PASS A — MATCHED-RATIO (matcher proxy; valid iff Pass C low) ══════');
  console.log(`  оценено ${ratios.length} | тонких ${dThin} | медиана ${(median * 100).toFixed(0)}% (missing ≈ ${(100 - median * 100).toFixed(0)}%)`);
  console.log(`  гистограмма: 0%=${ratios.filter((r) => r === 0).length} 1-25%=${bk(0.001, 0.25)} 26-50%=${bk(0.25, 0.5)} 51-75%=${bk(0.5, 0.75)} 76-99%=${bk(0.75, 1)} 100%=${ratios.filter((r) => r === 1).length}`);

  // PASS B mine apps (add to suspects)
  const MINE = ['k8s', 'restful', 'postgres', 'node.js', 'nodejs', ' node js', 'golang', ' go ', 'c++', 'c#', 'react native', 'react.js', 'react js'];
  const ors = MINE.map((m) => `(lower(o.description) LIKE '%${m}%' OR lower(u."resumeText") LIKE '%${m}%')`).join(' OR ');
  const mineIds = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT a.id FROM "AutoApplication" a JOIN "Opportunity" o ON o.id=a."opportunityId" JOIN "User" u ON u.id=a."userId" WHERE a."sentAt" IS NOT NULL AND (${ors}) ORDER BY a."sentAt" DESC LIMIT ${MINE_N}`);
  for (const { a, opp } of await load(mineIds.map((x) => x.id))) { const r = await run(a, opp); if (r) collect(a, r, 'mine'); }

  // PASS C — false-neg worklist
  console.log('\n══════ PASS C — FALSE-NEG (token-boundary worklist) ══════');
  let fneg = 0;
  for (const m of missingRecs) {
    const h = looseHit(m.searched, tokSet(`${m.cv} ${m.skills.join(' ')}`));
    if (h) { fneg++; console.log(`  ⚠️ «${m.label}» MISSING, токен «${h}» в CV → ${m.name}/${m.job}  | ${span(m.cv + ' ' + m.skills.join(', '), h)}`); }
  }
  console.log(`  suspected false-neg: ${fneg} из ${missingRecs.length} (${missingRecs.length ? (100 * fneg / missingRecs.length).toFixed(0) : 0}%) — worklist, классифицируй по 3 корзинам`);

  // PASS B — false-POS gate: every NON-EXACT full line (alias/collapse/short)
  const seen = new Set<string>();
  const uniq = suspects.filter((s) => { const k = s.name + '|' + s.l.label + '|' + s.l.member; if (seen.has(k)) return false; seen.add(k); return true; });
  let nAlias = 0, nCollapse = 0, nShort = 0;
  console.log(`\n══════ PASS B — FALSE-POS GATE — ${uniq.length} non-exact full-строк (eyeball каждую) ══════`);
  for (const s of uniq) {
    const tag = [s.l.viaCollapse ? '🟣COLLAPSE' : '', s.l.viaAlias ? '🔶ALIAS' : '', isShort(s.l) ? '🔻SHORT' : ''].filter(Boolean).join(' ');
    if (s.l.viaCollapse) nCollapse++; if (s.l.viaAlias) nAlias++; if (isShort(s.l)) nShort++;
    console.log(`\n— ${s.name} → «${s.job}» (${s.src})  «${s.l.label}» member=${s.l.member} → ${s.l.evidence}  ${tag}`);
    console.log(`   JD: ${span(s.jd, s.l.member || s.l.label)}`);
    console.log(`   CV: ${span(s.cv + ' ' + s.skills.join(', '), s.l.evidence || s.l.member || s.l.label)}`);
  }
  console.log(`\n  страта: collapse=${nCollapse} alias=${nAlias} short=${nShort} | всего non-exact=${uniq.length}`);
  console.log('  ↑ ГЕЙТ: 0 настоящих false-pos здесь (особенно 🟣COLLAPSE — новая поверхность) = верификатор к проду.');
}
main().catch((e) => { console.error('ERR', e); process.exit(1); }).finally(() => prisma.$disconnect());
