// GitHub review batch runner (verification Tier 1).
//
//   npx tsx scripts/github-review-batch.ts --discover [--dry-run] [--limit=N]
//     Pass 1: backfill User.githubUrl from resumeText + portfolioUrl (fill-only-missing).
//
//   npx tsx scripts/github-review-batch.ts --users=id1,id2 [--force] [--dry-run]
//   npx tsx scripts/github-review-batch.ts --all-devs-with-github [--limit=N] [--force]
//     Run the full review (GitHub fetch + AI assess + upsert GitHubReview).
//
// Env: DATABASE_URL, ZAI_API_KEY, GITHUB_TOKEN (5k req/hr; without it 60/hr — pass --allow-unauthed).
// Resumable: fresh reviews (same profileStamp, <30d) are skipped unless --force. Aborts on GitHub
// rate limit so the remaining quota isn't burned.

import { prisma } from '@/lib/db';
import { firstGitHubUrlFrom } from '@/lib/github-review/extract-username';
import { runGitHubReview } from '@/lib/github-review/run';
import { deriveCategorySlugs } from '@/lib/loop-routing';

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const opt = (name: string) => args.find(a => a.startsWith(`${name}=`))?.split('=').slice(1).join('=');

const DRY = has('--dry-run');
const FORCE = has('--force');
const LIMIT = Number(opt('--limit')) || 0;
const DEV_CATEGORIES = new Set(['engineering', 'devops', 'data', 'qa', 'security']);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function discover() {
  const users = await prisma.user.findMany({
    where: { githubUrl: null, OR: [{ resumeText: { not: null } }, { portfolioUrl: { not: null } }] },
    select: { id: true, email: true, portfolioUrl: true, resumeText: true },
    orderBy: { createdAt: 'desc' },
    ...(LIMIT ? { take: LIMIT * 20 } : {}), // scan more than we expect to hit; hits are ~13% of scanned
  });
  console.log(`[discover] scanning ${users.length} users without githubUrl${DRY ? ' (dry-run)' : ''}`);
  let found = 0;
  for (const u of users) {
    // explicit candidate-entered portfolioUrl wins over résumé text
    const gh = firstGitHubUrlFrom(u.portfolioUrl, u.resumeText);
    if (!gh) continue;
    found++;
    console.log(`  ${u.email}  →  ${gh}`);
    if (!DRY) await prisma.user.update({ where: { id: u.id }, data: { githubUrl: gh } });
    if (LIMIT && found >= LIMIT) break;
  }
  console.log(`[discover] ${DRY ? 'would set' : 'set'} githubUrl for ${found} users`);
}

async function review(userIds: string[]) {
  if (!process.env.GITHUB_TOKEN && !has('--allow-unauthed')) {
    console.error('GITHUB_TOKEN not set (60 req/hr anonymous ≈ 20 users/hr). Set it or pass --allow-unauthed.');
    process.exit(1);
  }
  if (!process.env.ZAI_API_KEY) {
    console.error('ZAI_API_KEY not set — the AI assessment half cannot run.');
    process.exit(1);
  }
  console.log(`[review] ${userIds.length} users${FORCE ? ' (force)' : ''}${DRY ? ' (dry-run)' : ''}`);
  const counts: Record<string, number> = {};
  for (const [i, id] of userIds.entries()) {
    if (DRY) {
      const u = await prisma.user.findUnique({ where: { id }, select: { email: true, githubUrl: true } });
      console.log(`  [${i + 1}/${userIds.length}] ${u?.email} ${u?.githubUrl || 'NO GITHUB URL'} (dry-run, not fetched)`);
      continue;
    }
    const res = await runGitHubReview(id, { force: FORCE });
    counts[res.status === 'skipped' ? `skipped:${res.reason}` : res.status] =
      (counts[res.status === 'skipped' ? `skipped:${res.reason}` : res.status] || 0) + 1;
    if (res.status === 'done') {
      console.log(`  [${i + 1}/${userIds.length}] ${id} → ${res.report.verdict} (stack ${res.report.stackMatch}, ${res.report.activityLevel}, ${res.report.commits90d}+ commits/90d)`);
    } else if (res.status === 'cached') {
      console.log(`  [${i + 1}/${userIds.length}] ${id} → cached (${res.report.verdict})`);
    } else {
      console.log(`  [${i + 1}/${userIds.length}] ${id} → skipped: ${res.reason}`);
      if (res.reason === 'rate_limited') {
        console.error('GitHub rate limit hit — aborting (script is resumable, done users are cached).');
        break;
      }
    }
    await sleep(500);
  }
  console.log('[review] summary:', JSON.stringify(counts));
}

async function allDevsWithGithub(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { githubUrl: { not: null } },
    select: { id: true, parsedProfile: true },
    orderBy: { lastActiveAt: { sort: 'desc', nulls: 'last' } },
  });
  const devs = users.filter(u => {
    const pp = u.parsedProfile as Record<string, unknown> | null;
    const slugs = deriveCategorySlugs({
      currentTitle: typeof pp?.current_title === 'string' ? pp.current_title : null,
      field: typeof pp?.field === 'string' ? pp.field : null,
      skills: Array.isArray(pp?.skills) ? (pp.skills as unknown[]).map(String) : [],
    });
    return slugs.some(s => DEV_CATEGORIES.has(s));
  });
  return (LIMIT ? devs.slice(0, LIMIT) : devs).map(u => u.id);
}

async function main() {
  if (has('--discover')) {
    await discover();
  } else if (opt('--users')) {
    await review(opt('--users')!.split(',').filter(Boolean));
  } else if (has('--all-devs-with-github')) {
    const ids = await allDevsWithGithub();
    await review(ids);
  } else {
    console.log('Usage: --discover | --users=id1,id2 | --all-devs-with-github  [--dry-run] [--force] [--limit=N] [--allow-unauthed]');
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
