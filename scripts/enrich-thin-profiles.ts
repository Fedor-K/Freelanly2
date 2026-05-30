/**
 * Enrich thin candidate profiles by re-parsing already-stored résumé text.
 *
 * Why: the recruiter card-quality panel shows many candidates with no parsed skills/title even
 * though we have their résumé text on file (User.resumeText, up to 10k chars). Thin cards give
 * recruiters nothing to act on → low reveal/reply. This re-runs extraction on the stored text
 * (no file re-fetch) and FILLS ONLY MISSING fields — it never overwrites good data.
 *
 * Scope: only candidates we've actually sent applications for (the cards recruiters see).
 * Idempotent and safe to re-run. Run where DB + ZAI_API_KEY are available:
 *   npx tsx scripts/enrich-thin-profiles.ts --dry-run
 *   npx tsx scripts/enrich-thin-profiles.ts --limit=200
 */
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();

// Self-contained AI client (z.ai GLM), mirroring the app's provider so we don't depend on a
// non-exported internal helper. Same model the resume parser uses.
const ai = new OpenAI({ apiKey: process.env.ZAI_API_KEY || '', baseURL: 'https://api.z.ai/api/paas/v4' });
const AI_MODEL = 'glm-4-32b-0414-128k';

type Profile = {
  name?: string | null;
  current_title?: string | null;
  field?: string | null;
  experience_years?: number | null;
  summary?: string | null;
  skills?: string[];
  languages?: string[];
};

function skillsOf(p: unknown): string[] {
  const s = (p as Profile | null)?.skills;
  return Array.isArray(s) ? s.filter((x): x is string => typeof x === 'string') : [];
}

async function extractFromText(text: string): Promise<Profile | null> {
  const res = await ai.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.2,
    max_tokens: 600,
    messages: [
      {
        role: 'system',
        content:
          'Extract a structured profile from this résumé text. Return ONLY JSON: ' +
          '{"name":string|null,"current_title":string|null,"field":string|null,' +
          '"experience_years":number|null,"summary":string|null,"skills":string[],"languages":string[]}. ' +
          'Extract as many real skills as you can find (up to 20). Never invent. Empty array/null if absent.',
      },
      { role: 'user', content: text.slice(0, 10000) },
    ],
  });
  const raw = res.choices[0]?.message?.content?.trim() || '';
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Profile;
  } catch {
    return null;
  }
}

// Merge: only fill fields that are missing/empty on the existing profile. Never overwrite.
function mergeFillOnly(existing: Profile | null, fresh: Profile): { merged: Profile; changed: string[] } {
  const base: Profile = { ...(existing || {}) };
  const changed: string[] = [];
  const emptyStr = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '');

  if (skillsOf(base).length === 0 && (fresh.skills?.length || 0) > 0) {
    base.skills = fresh.skills!.slice(0, 20);
    changed.push(`skills(${base.skills.length})`);
  }
  if (emptyStr(base.current_title) && !emptyStr(fresh.current_title)) {
    base.current_title = fresh.current_title!;
    changed.push('title');
  }
  if (emptyStr(base.field) && !emptyStr(fresh.field)) {
    base.field = fresh.field!;
    changed.push('field');
  }
  if (emptyStr(base.summary) && !emptyStr(fresh.summary)) {
    base.summary = fresh.summary!;
    changed.push('summary');
  }
  if (base.experience_years == null && typeof fresh.experience_years === 'number') {
    base.experience_years = fresh.experience_years;
    changed.push('experience_years');
  }
  if ((!base.languages || base.languages.length === 0) && (fresh.languages?.length || 0) > 0) {
    base.languages = fresh.languages!;
    changed.push(`languages(${base.languages.length})`);
  }
  return { merged: base, changed };
}

async function main() {
  const args = process.argv.slice(2);
  const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || 200);
  const dryRun = args.includes('--dry-run');

  if (!process.env.ZAI_API_KEY) {
    console.error('ZAI_API_KEY missing — cannot enrich.');
    process.exit(1);
  }

  // Candidates we've applied for, with résumé text. Thin (no parsed skills) filtered in JS,
  // since JSON skills-array length isn't a cheap WHERE; over-fetch then slice to limit.
  const candidates = await prisma.user.findMany({
    where: {
      resumeText: { not: null },
      autoApplications: { some: { sentAt: { not: null } } },
    },
    select: { id: true, email: true, resumeText: true, parsedProfile: true },
    take: limit * 3,
  });

  const thin = candidates.filter((c) => skillsOf(c.parsedProfile).length === 0).slice(0, limit);
  console.log(`Found ${thin.length} thin profiles with résumé text (limit ${limit}, dry-run: ${dryRun}).`);

  let enriched = 0, skipped = 0, failed = 0;
  for (const c of thin) {
    const text = (c.resumeText || '').trim();
    if (text.length < 50) { skipped++; continue; }
    try {
      const fresh = await extractFromText(text);
      if (!fresh) { failed++; continue; }
      const { merged, changed } = mergeFillOnly(c.parsedProfile as Profile | null, fresh);
      if (changed.length === 0) { skipped++; continue; }
      if (!dryRun) {
        await prisma.user.update({
          where: { id: c.id },
          data: {
            parsedProfile: merged as object,
            ...(merged.name && !(c.parsedProfile as Profile | null)?.name ? { name: merged.name } : {}),
          },
        });
      }
      enriched++;
      console.log(`${dryRun ? '[dry] ' : ''}${c.email}: +${changed.join(', ')}`);
    } catch (e) {
      failed++;
      console.error(`${c.email}: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 200)); // gentle on the AI endpoint
  }

  console.log(`\nDone. enriched=${enriched} skipped=${skipped} failed=${failed}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
