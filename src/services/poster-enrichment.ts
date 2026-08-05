import { prisma } from '@/lib/db';
import { resolveCountry, blockedCountries } from '@/lib/region-block';
import { normalizeLinkedInUrl } from '@/lib/linkedin-profile';

// ── Supply-side poster-location filter ───────────────────────────────────────
// Resolve the LinkedIn POST AUTHOR's (recruiter's) country and block posts from blocked-country
// recruiters at import. The post actor doesn't return author location, so we scrape the poster's
// profile (harvestapi, pinned build) ONCE and cache it per LinkedIn URL in a raw-SQL table (kept out
// of the Prisma schema to avoid a migration / client-wide SELECT drift). Gated behind
// POSTER_REGION_FILTER=on. Fail-open: any scrape/parse failure → country null → NOT blocked.

let cacheReady = false;
async function ensureCache(): Promise<void> {
  if (cacheReady) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PosterLocation" (
    "linkedinUrl" text PRIMARY KEY,
    country text,
    location text,
    "openToWork" boolean,
    "scrapedAt" timestamptz NOT NULL DEFAULT now()
  )`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE "PosterLocation" ADD COLUMN IF NOT EXISTS "openToWork" boolean`).catch(() => {});
  cacheReady = true;
}

async function scrapePosterLocation(url: string): Promise<{ country: string | null; location: string | null; openToWork: boolean }> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return { country: null, location: null, openToWork: false };
  const build = process.env.APIFY_LI_PROFILE_BUILD || '0.0.122'; // latest 0.0.123 is broken — see linkedin-profile.ts
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items?token=${token}&build=${encodeURIComponent(build)}`,
      // The actor can take 25-30s on a cold profile (one observed at 27s) — a 15s cap would kill it →
      // null → fail-open → no block. 35s gives it room; cached after the first hit so it's one-time.
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: [url] }), signal: AbortSignal.timeout(35000) }
    );
    if (!res.ok) return { country: null, location: null, openToWork: false };
    const items = await res.json();
    const pr = Array.isArray(items) ? items[0] : null;
    if (!pr) return { country: null, location: null, openToWork: false };
    const locObj = (pr.location && typeof pr.location === 'object') ? pr.location : null;
    // Prefer the actor's normalized ISO2; fall back to our freeform resolver on the text.
    const iso = locObj?.parsed?.countryCode || locObj?.countryCode || null;
    const locText = typeof pr.location === 'string' ? pr.location : (locObj?.linkedinText || locObj?.parsed?.text || null);
    const country = iso ? String(iso).toUpperCase() : resolveCountry(locText);
    // openToWork = the LinkedIn "Open To Work" banner. A "recruiter" who is themselves open-to-work is
    // a job-seeker posing as a hirer (bench/fake recruiter) — the webhook drops their posts.
    return { country: country || null, location: locText || null, openToWork: pr.openToWork === true };
  } catch {
    return { country: null, location: null, openToWork: false };
  }
}

/**
 * Resolve a poster's country (cached per LinkedIn URL) and whether they're in the blocked set.
 * `blocked` is only ever true for a KNOWN blocked country — unknown/failed → false (fail-open).
 */
/** Company/showcase pages are not profiles: the profile actor bills $0.004 and returns only a name —
 *  no location, no openToWork (verified 2026-08-05: 573 company rows cached, 0 with a country).
 *  Neither gate can ever fire on them, so we never pay for one. */
function isCompanyUrl(url: string): boolean {
  return /linkedin\.com\/(company|showcase|school)\//i.test(url);
}

/** In-flight de-dup: n8n POSTs several posts by the same author at once and every one used to miss
 *  the DB cache and fire its own $0.004 scrape (measured: 2,520 duplicate scrapes inside 60s in 20d,
 *  one URL hit 16x). Concurrent callers now share the first scrape's promise. */
const inFlight = new Map<string, Promise<{ country: string | null; location: string | null; openToWork: boolean }>>();

export async function getPosterRegion(linkedinUrl: string | null | undefined): Promise<{ country: string | null; blocked: boolean; openToWork: boolean; cached: boolean }> {
  const BLOCK = new Set(blockedCountries());
  if (!linkedinUrl) return { country: null, blocked: false, openToWork: false, cached: false };
  const url = normalizeLinkedInUrl(linkedinUrl) || linkedinUrl;
  if (isCompanyUrl(url)) return { country: null, blocked: false, openToWork: false, cached: true };
  await ensureCache();
  try {
    const hit = await prisma.$queryRaw<{ country: string | null; openToWork: boolean | null }[]>`SELECT country, "openToWork" FROM "PosterLocation" WHERE "linkedinUrl" = ${url}`;
    if (hit.length) {
      const c = hit[0].country;
      return { country: c, blocked: !!c && BLOCK.has(c), openToWork: hit[0].openToWork === true, cached: true };
    }
  } catch { /* table read failed → treat as miss */ }

  let pending = inFlight.get(url);
  const isLeader = !pending;
  if (!pending) {
    pending = scrapePosterLocation(url).finally(() => inFlight.delete(url));
    inFlight.set(url, pending);
  }
  const { country, location, openToWork } = await pending;

  if (isLeader) {
    // Cache the result (incl. null) to bound cost; a backfill can refresh WHERE country IS NULL later.
    await prisma.$executeRaw`
      INSERT INTO "PosterLocation" ("linkedinUrl", country, location, "openToWork")
      VALUES (${url}, ${country}, ${location}, ${openToWork})
      ON CONFLICT ("linkedinUrl") DO UPDATE SET country = EXCLUDED.country, location = EXCLUDED.location, "openToWork" = EXCLUDED."openToWork", "scrapedAt" = now()
    `.catch(() => {});
  }
  return { country, blocked: !!country && BLOCK.has(country), openToWork, cached: !isLeader };
}
