// Careerjet CPC job feed — server-side fetch through the n8n proxy.
//
// The proxy is an n8n webhook running on our static IP (23.95.182.87, whitelisted with Careerjet). It
// holds the API key and calls Careerjet's Search API; we just hand it the visitor's context. Clicking
// a returned job's `url` (a jobviewtrack.com tracking link) is a billable CPC event credited to our
// publisher account — that is the whole point: monetize job-seeker traffic we don't otherwise convert.
//
// Everything here is best-effort: any failure returns an empty list so the feed just shows our own
// opportunities. The proxy URL carries a random, unguessable path — it is an endpoint, not a secret;
// the Careerjet API key never leaves n8n.

const PROXY_URL = (process.env.CAREERJET_PROXY_URL
  || 'https://n8n.freelanly.com/webhook/cj-43a0d51bf633560740a0').trim();

// Second CPC source: Adzuna (via its own n8n proxy holding the app_id/app_key). Adzuna needs no IP
// whitelist, and its redirect_url click-throughs work for real users — so it keeps the feed earning
// even when Careerjet's tracking is down. Adzuna has local sites for only these countries; for any
// other geo we skip Adzuna (Careerjet covers the rest).
const ADZUNA_PROXY_URL = (process.env.ADZUNA_PROXY_URL
  || 'https://n8n.freelanly.com/webhook/adz-16d6cf502fc4ea63e992').trim();
const ADZUNA_COUNTRIES = new Set(['us', 'gb', 'ca', 'au', 'br', 'mx', 'de', 'fr', 'it', 'nl', 'at', 'pl', 'nz', 'sg', 'za', 'in']);

export interface CareerjetJob {
  title: string;
  company: string;
  locations: string;
  description?: string;
  salary?: string;
  salary_currency_code?: string;
  salary_type?: string; // Careerjet period code: Y/M/W/D/H
  url: string;          // tracking link — the billable click target
  date?: string;
}

// Tier-1 geos pay the highest CPC and their own-country inventory matches these visitors directly, so
// we serve local jobs. Everyone else gets remote-biased results — an out-of-geo click on a local-only
// role does not bill, but a remote/global role does.
const TIER1 = new Set(['US', 'GB', 'CA', 'AU', 'IE', 'DE', 'FR', 'NL', 'IT', 'ES', 'CH', 'SE', 'NO', 'DK', 'BE', 'AT', 'FI', 'NZ']);

// ISO country → Careerjet locale_code. Unknown → en_US (broadest inventory).
const LOCALE: Record<string, string> = {
  US: 'en_US', GB: 'en_GB', CA: 'en_CA', AU: 'en_AU', IE: 'en_IE', IN: 'en_IN', PK: 'en_PK',
  NG: 'en_NG', PH: 'en_PH', ZA: 'en_ZA', SG: 'en_SG', NZ: 'en_NZ',
  ES: 'es_ES', MX: 'es_MX', AR: 'es_AR', CO: 'es_CO', CL: 'es_CL', PE: 'es_PE', VE: 'es_VE',
  EC: 'es_EC', BO: 'es_BO', PY: 'es_PY', UY: 'es_UY', CR: 'es_CR', PA: 'es_PA', DO: 'es_DO',
  GT: 'es_GT', HN: 'es_HN', NI: 'es_NI', SV: 'es_SV',
  BR: 'pt_BR', PT: 'pt_PT',
  DE: 'de_DE', AT: 'de_AT', FR: 'fr_FR', BE: 'fr_BE', IT: 'it_IT', NL: 'nl_NL',
  SE: 'sv_SE', NO: 'no_NO', DK: 'da_DK', FI: 'fi_FI', PL: 'pl_PL',
};

export function countryToLocale(country?: string | null): string {
  if (!country) return 'en_US';
  return LOCALE[country.toUpperCase()] || 'en_US';
}

export function isTier1(country?: string | null): boolean {
  return !!country && TIER1.has(country.toUpperCase());
}

export interface FetchArgs {
  keywords: string;
  country?: string | null;
  userIp: string;
  userAgent: string;
  referer: string;
  pageSize?: number;
}

export async function fetchCareerjetJobs(args: FetchArgs): Promise<CareerjetJob[]> {
  const { keywords, country, userIp, userAgent, referer } = args;
  // Careerjet requires a real user_ip and user_agent; without them it returns "Invalid user_ip".
  if (!keywords.trim() || !userIp || !userAgent) return [];

  const localeCode = countryToLocale(country);
  // Geo-routing: Tier-1 visitors get their own-country jobs (highest CPC); everyone else gets
  // remote-biased results, the only inventory that bills for an out-of-geo click.
  const kw = isTier1(country) ? keywords : `${keywords} remote`;

  const qs = new URLSearchParams({
    keywords: kw,
    locale_code: localeCode,
    page_size: String(args.pageSize ?? 6),
    sort: 'date', // newest-first — freshest roles convert best (relevance sort mixed in 3-4 week-old posts)
    user_ip: userIp,
    user_agent: userAgent,
    referer,
  });

  try {
    const res = await fetch(`${PROXY_URL}?${qs.toString()}`, {
      // Never cache: user_ip varies per visitor and drives Careerjet attribution/fraud checks.
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => null)) as { type?: string; jobs?: CareerjetJob[] } | null;
    if (!data || data.type !== 'JOBS' || !Array.isArray(data.jobs)) return [];
    return data.jobs.filter((j) => j && j.url && j.title);
  } catch {
    return [];
  }
}

/** Visitor country → Adzuna country code (lowercase), or null when Adzuna has no local site there. */
export function adzunaCountry(country?: string | null): string | null {
  if (!country) return 'us';
  const c = country.toLowerCase();
  return ADZUNA_COUNTRIES.has(c) ? c : null;
}

interface AdzunaResult {
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  redirect_url?: string;
  created?: string;
}

/** Fetch Adzuna jobs for the visitor's country, mapped to the shared CareerjetJob shape (url =
 *  redirect_url, the billable click). Best-effort; [] on any failure or when the geo has no Adzuna site. */
export async function fetchAdzunaJobs(args: { keywords: string; country?: string | null; pageSize?: number }): Promise<CareerjetJob[]> {
  if (!args.keywords.trim()) return [];
  const country = adzunaCountry(args.country);
  if (!country) return [];
  const qs = new URLSearchParams({
    country,
    keywords: args.keywords,
    page_size: String(args.pageSize ?? 8),
  });
  try {
    const res = await fetch(`${ADZUNA_PROXY_URL}?${qs.toString()}`, { cache: 'no-store', signal: AbortSignal.timeout(9000) });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => null)) as { results?: AdzunaResult[] } | null;
    if (!data || !Array.isArray(data.results)) return [];
    return data.results
      .filter((r) => r && r.redirect_url && r.title)
      .map((r) => ({
        title: r.title as string,
        company: r.company?.display_name || '',
        locations: r.location?.display_name || '',
        url: r.redirect_url as string,
        date: r.created,
      }));
  } catch {
    return [];
  }
}

/** Interleave two source lists so the feed shows a mix of both networks. */
export function interleaveJobs(a: CareerjetJob[], b: CareerjetJob[]): CareerjetJob[] {
  const out: CareerjetJob[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}
