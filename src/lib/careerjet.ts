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
