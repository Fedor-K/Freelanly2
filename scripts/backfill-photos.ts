// Backfill candidate photos: re-scrape LinkedIn (Apify) for candidates whose photo is missing or an
// expired licdn URL, then cache the fresh photo to our Blob (permanent). Matches results to candidates
// by /in/<slug>. Run: DATABASE_URL="…" npx tsx scripts/backfill-photos.ts [limit]
// APIFY_API_TOKEN + BLOB_READ_WRITE_TOKEN are loaded from /tmp/prod.env.
import * as fs from 'fs';
import { prisma } from '@/lib/db';
import { cacheProfilePhotoToBlob } from '@/lib/linkedin-profile';

try {
  for (const line of fs.readFileSync('/tmp/prod.env', 'utf8').split('\n')) {
    const i = line.indexOf('='); if (i < 1) continue;
    const k = line.slice(0, i).trim(); const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (['APIFY_API_TOKEN', 'BLOB_READ_WRITE_TOKEN', 'APIFY_LI_PROFILE_BUILD'].includes(k) && !process.env[k]) process.env[k] = v;
  }
} catch { /* ignore */ }

const LIMIT = parseInt(process.argv[2] || '30', 10);
const BATCH = 20;
const log = (...a: unknown[]) => console.error(...a);

function slug(u: string | null | undefined): string {
  const s = String(u || '');
  const m = s.match(/\/in\/([^/?#]+)/i);
  const raw = m ? m[1] : (s.includes('/') || s.includes('.') ? '' : s); // bare publicIdentifier
  return decodeURIComponent(raw).toLowerCase().replace(/\/+$/, '');
}

async function scrapeBatch(urls: string[]): Promise<Map<string, string>> {
  const token = process.env.APIFY_API_TOKEN;
  const build = process.env.APIFY_LI_PROFILE_BUILD || '0.0.122';
  const out = new Map<string, string>();
  try {
    const res = await fetch(`https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items?token=${token}&build=${encodeURIComponent(build)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls }), signal: AbortSignal.timeout(180000) });
    if (!res.ok) { log('  apify HTTP ' + res.status); return out; }
    const items = await res.json();
    for (const pr of (Array.isArray(items) ? items : [])) {
      const photo = (typeof pr.photo === 'string' && pr.photo) ? pr.photo
        : (pr.profilePicture?.url && typeof pr.profilePicture.url === 'string') ? pr.profilePicture.url : null;
      const key = slug(pr.linkedinUrl || pr.url || pr.profileUrl || pr.publicIdentifier || pr.username);
      if (photo && key) out.set(key, photo);
    }
  } catch (e) { log('  batch err: ' + ((e as Error)?.message || e)); }
  return out;
}

async function main() {
  const cands = await prisma.user.findMany({
    where: {
      resumeUrl: { not: null },
      linkedinUrl: { contains: 'linkedin.com/in/' },
      NOT: { image: { contains: 'blob.vercel-storage' } },
    },
    select: { id: true, linkedinUrl: true },
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
  });
  log(`candidates to backfill: ${cands.length}`);

  let scraped = 0, photoFound = 0, cached = 0, noMatch = 0;
  for (let i = 0; i < cands.length; i += BATCH) {
    const slice = cands.slice(i, i + BATCH);
    const urls = slice.map(c => c.linkedinUrl!).filter(Boolean);
    log(`batch ${i / BATCH + 1}: scraping ${urls.length}…`);
    const photoBySlug = await scrapeBatch(urls);
    scraped += urls.length;
    for (const c of slice) {
      const photo = photoBySlug.get(slug(c.linkedinUrl));
      if (!photo) { noMatch++; continue; }
      photoFound++;
      try {
        const blobUrl = await cacheProfilePhotoToBlob(photo, c.id);
        if (blobUrl) {
          await prisma.user.update({ where: { id: c.id }, data: { image: blobUrl } });
          cached++;
        }
      } catch (e) { log('  update skip ' + c.id + ': ' + ((e as Error)?.message || e).slice(0, 60)); }
    }
    log(`  …running totals: scraped=${scraped} photoFound=${photoFound} cached=${cached} noMatch=${noMatch}`);
  }
  log(`\nDONE — scraped ${scraped}, photos found ${photoFound}, cached to blob ${cached}, no-photo/no-match ${noMatch}`);
  console.log(JSON.stringify({ scraped, photoFound, cached, noMatch }));
}

main().then(() => process.exit(0)).catch(e => { log('ERR ' + (e?.message || e)); process.exit(1); });
