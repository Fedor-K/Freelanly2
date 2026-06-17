// Shared audience region gate (demand + supply). Resolves a freeform location string to an ISO2
// country and checks it against the MATCH_REGION_BLOCK env list (comma ISO2). Used by:
//   - registration (resume-preauth): reject signups from blocked countries
//   - post import (linkedin-posts webhook): drop posts from blocked-country recruiters
// The matcher (auto-apply-processor.ts) keeps its own copy (incl. an UNKNOWN-blocks rule). Here,
// UNKNOWN (unresolvable location) is NOT blocked — we don't turn away a signup / drop supply we
// can't classify (avoids cutting wanted US/EU people whose location string didn't parse).
//
// Keep PREFILTER_COUNTRY_PATTERNS in sync with auto-apply-processor.ts (country regexes change rarely).

const COUNTRY_PATTERNS: [RegExp, string][] = [
  [/\b(usa|u\.s\.a|u\.s\.|united states|america)\b|,\s*(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)\b\.?$|\b(new york|los angeles|chicago|houston|dallas|austin|seattle|miami|boston|atlanta|denver|phoenix|san francisco|san jose|san diego)\b/i, 'US'],
  [/\bindia\b|\b(hyderabad|bangalore|bengaluru|mumbai|delhi|chennai|pune|kolkata|noida|gurgaon|gurugram|ahmedabad|jaipur|kochi|indore|telangana|maharashtra|karnataka)\b/i, 'IN'],
  [/\b(uk|u\.k\.|united kingdom|england|scotland|wales)\b|\b(london|manchester|birmingham|leeds|glasgow|edinburgh)\b/i, 'GB'],
  [/\bcanada\b|\b(toronto|vancouver|montreal|ottawa|calgary|edmonton|ontario|quebec|british columbia)\b/i, 'CA'],
  [/\bgermany\b|\b(berlin|munich|hamburg|frankfurt|cologne|stuttgart)\b/i, 'DE'],
  [/\bfrance\b|\b(paris|lyon|marseille|toulouse)\b/i, 'FR'],
  [/\bspain\b|\b(madrid|barcelona|valencia|seville)\b/i, 'ES'],
  [/\bitaly\b|\b(rome|milan|turin|naples)\b/i, 'IT'],
  [/\bnetherlands\b|\b(amsterdam|rotterdam|the hague|utrecht)\b/i, 'NL'],
  [/\bpoland\b|\b(warsaw|krakow|wroclaw|gdansk)\b/i, 'PL'],
  [/\bportugal\b|\b(lisbon|porto)\b/i, 'PT'],
  [/\bukraine\b|\b(kyiv|kiev|kharkiv|lviv|odesa)\b/i, 'UA'],
  [/\bpakistan\b|\b(karachi|lahore|islamabad|rawalpindi)\b/i, 'PK'],
  [/\bbangladesh\b|\b(dhaka|chittagong)\b/i, 'BD'],
  [/\bnigeria\b|\b(lagos|abuja|ibadan|port harcourt)\b/i, 'NG'],
  [/\bkenya\b|\bnairobi\b/i, 'KE'],
  [/\begypt\b|\b(cairo|alexandria|giza)\b/i, 'EG'],
  [/\bghana\b|\baccra\b/i, 'GH'],
  [/\buganda\b|\bkampala\b/i, 'UG'],
  [/\bethiopia\b|\baddis ababa\b/i, 'ET'],
  [/\bmorocco\b|\b(casablanca|rabat|marrakech)\b/i, 'MA'],
  [/\bcameroon\b|\b(douala|yaounde|yaoundé)\b/i, 'CM'],
  [/\btanzania\b|\b(dar es salaam|dodoma)\b/i, 'TZ'],
  [/\bphilippines\b|\b(manila|cebu|davao|quezon)\b/i, 'PH'],
  [/\bindonesia\b|\b(jakarta|surabaya|bandung)\b/i, 'ID'],
  [/\bvietnam\b|\b(hanoi|ho chi minh|saigon|da nang)\b/i, 'VN'],
  [/\bbrazil\b|\b(sao paulo|são paulo|rio de janeiro|belo horizonte|brasilia)\b/i, 'BR'],
  [/\bmexico\b|\b(mexico city|guadalajara|monterrey)\b/i, 'MX'],
  [/\bargentina\b|\bbuenos aires\b/i, 'AR'],
  [/\bcolombia\b|\b(bogota|bogotá|medellin|medellín|cali)\b/i, 'CO'],
  [/\bturkey\b|\bt[uü]rkiye\b|\b(istanbul|ankara|izmir)\b/i, 'TR'],
  [/\b(uae|united arab emirates)\b|\b(dubai|abu dhabi|sharjah)\b/i, 'AE'],
  [/\bsaudi arabia\b|\b(riyadh|jeddah)\b/i, 'SA'],
  [/\baustralia\b|\b(sydney|melbourne|brisbane|perth)\b/i, 'AU'],
  [/\bsouth africa\b|\b(johannesburg|cape town|durban|pretoria)\b/i, 'ZA'],
  [/\bsri lanka\b|\bcolombo\b/i, 'LK'],
  [/\bnepal\b|\bkathmandu\b/i, 'NP'],
];

export function resolveCountry(loc: string | null | undefined): string | null {
  if (!loc) return null;
  for (const [re, iso] of COUNTRY_PATTERNS) if (re.test(loc)) return iso;
  return null;
}

const BLOCK = new Set((process.env.MATCH_REGION_BLOCK || '').split(',').map((s) => s.trim().toUpperCase()).filter((s) => s && s !== 'UNKNOWN'));

export function regionBlockEnabled(): boolean {
  return BLOCK.size > 0;
}

/** True only when the location resolves to a country that is in the block set. Unknown → false. */
export function isLocationBlocked(loc: string | null | undefined): boolean {
  if (!BLOCK.size) return false;
  const c = resolveCountry(loc);
  return c ? BLOCK.has(c) : false;
}

export function blockedCountries(): string[] {
  return [...BLOCK];
}
