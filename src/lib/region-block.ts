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
  // Expanded India coverage — added 2026-06-19 after VPN users with address-only locations
  // ("Kanpur U.P.") slipped resolution → UNKNOWN. States (full names) + major cities + "U.P." abbr.
  [/\b(uttar pradesh|tamil nadu|west bengal|madhya pradesh|andhra pradesh|rajasthan|gujarat|kerala|haryana|punjab|bihar|odisha|assam|jharkhand|uttarakhand|chhattisgarh|\bgoa\b)\b|\bu\.p\.|\b(kanpur|lucknow|nagpur|surat|vadodara|coimbatore|visakhapatnam|vizag|thane|patna|ghaziabad|ludhiana|\bagra\b|nashik|faridabad|meerut|rajkot|varanasi|bhopal|mysore|mysuru|thiruvananthapuram|trivandrum|mohali|chandigarh|cochin|madurai|vijayawada|guwahati|ranchi|raipur|dehradun)\b/i, 'IN'],
  [/\b(uk|u\.k\.|united kingdom|england|scotland|wales)\b|\b(london|manchester|birmingham|leeds|glasgow|edinburgh)\b/i, 'GB'],
  [/\bcanada\b|\b(toronto|vancouver|montreal|ottawa|calgary|edmonton|ontario|quebec|british columbia)\b/i, 'CA'],
  [/\bgermany\b|\b(berlin|munich|hamburg|frankfurt|cologne|stuttgart)\b/i, 'DE'],
  [/\bfrance\b|\b(paris|lyon|marseille|toulouse)\b/i, 'FR'],
  [/\bspain\b|\bespa[ñn]a\b|\b(madrid|barcelona|valencia|seville|sevilla)\b/i, 'ES'],
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
  [/\bbra[sz]il\b|\b(sao paulo|são paulo|rio de janeiro|belo horizonte|bras[ií]lia)\b/i, 'BR'],
  [/\bm[eé]xico\b|\b(mexico city|ciudad de m[eé]xico|cdmx|guadalajara|monterrey)\b/i, 'MX'],
  [/\bargentina\b|\bbuenos aires\b/i, 'AR'],
  [/\bcolombia\b|\b(bogota|bogotá|medellin|medellín|cali)\b/i, 'CO'],
  [/\bturkey\b|\bt[uü]rkiye\b|\b(istanbul|ankara|izmir)\b/i, 'TR'],
  [/\b(uae|united arab emirates)\b|\b(dubai|abu dhabi|sharjah)\b/i, 'AE'],
  [/\bsaudi arabia\b|\b(riyadh|jeddah)\b/i, 'SA'],
  [/\baustralia\b|\b(sydney|melbourne|brisbane|perth)\b/i, 'AU'],
  [/\bsouth africa\b|\b(johannesburg|cape town|durban|pretoria)\b/i, 'ZA'],
  [/\bsri lanka\b|\bcolombo\b/i, 'LK'],
  [/\bnepal\b|\bkathmandu\b/i, 'NP'],
  // Additional GOOD (kept) countries — added 2026-06-17 after ~500 full-cycle LATAM/EU users were
  // falling into UNKNOWN (resolver only knew BR/MX/AR/CO). US pattern is first above, so US-city
  // collisions (e.g. "Lima, OH") are caught as US before these.
  [/\bperu\b|\bper[uú](?![a-z])|\blima\b/i, 'PE'],
  [/\bvenezuela\b|\b(caracas|maracaibo|barquisimeto)\b/i, 'VE'],
  [/\bchile\b|\bsantiago metropolitan\b/i, 'CL'],
  [/\becuador\b|\b(quito|guayaquil)\b/i, 'EC'],
  [/\buruguay\b|\bmontevideo\b/i, 'UY'],
  [/\b(dominican republic|rep[uú]blica dominicana)\b|\bsanto domingo\b/i, 'DO'],
  [/\bnicaragua\b|\bmanagua\b/i, 'NI'],
  [/\bcosta rica\b/i, 'CR'],
  [/\bpanam[aá](?![a-z])/i, 'PA'],
  [/\bguatemala\b/i, 'GT'],
  [/\bbolivia\b|\bla paz\b/i, 'BO'],
  [/\bparaguay\b|\basunci[oó]n\b/i, 'PY'],
  [/\bhonduras\b|\btegucigalpa\b/i, 'HN'],
  [/\bel salvador\b|\bsan salvador\b/i, 'SV'],
  [/\bserbia\b|\bbelgrade\b/i, 'RS'],
  [/\bromania\b|\bbucharest\b/i, 'RO'],
  [/\bgreece\b|\bathens\b/i, 'GR'],
  [/\bczech\b|\bprague\b/i, 'CZ'],
  [/\bhungary\b|\bbudapest\b/i, 'HU'],
  [/\b(jordan|amman)\b/i, 'JO'],
  [/\bisrael\b|\b(tel aviv|jerusalem)\b/i, 'IL'],
  [/\btbilisi\b/i, 'GE'],
  // Blocked off-thesis regions — added 2026-06-18 (Gulf, MENA, Central/SE Asia, Sub-Saharan tail).
  // Full names + capitals only, word-boundary anchored (e.g. \boman\b does NOT match "Romania").
  [/\bqatar\b|\bdoha\b/i, 'QA'],
  [/\boman\b|\bmuscat\b/i, 'OM'],
  [/\bbahrain\b|\bmanama\b/i, 'BH'],
  [/\bkuwait\b/i, 'KW'],
  [/\byemen\b|\b(sana'?a|aden)\b/i, 'YE'],
  [/\bmalaysia\b|\b(kuala lumpur|penang|johor)\b/i, 'MY'],
  [/\btunisia\b|\btunis\b/i, 'TN'],
  [/\balgeria\b|\b(algiers|oran)\b/i, 'DZ'],
  [/\biraq\b|\b(baghdad|basra|erbil)\b/i, 'IQ'],
  [/\blebanon\b|\bbeirut\b/i, 'LB'],
  [/\buzbekistan\b|\b(tashkent|samarkand)\b/i, 'UZ'],
  [/\bthailand\b|\bbangkok\b/i, 'TH'],
  [/\bchina\b|\b(beijing|shanghai|shenzhen|guangzhou|hangzhou)\b/i, 'CN'],
  [/\b(palestine|palestinian)\b|\b(gaza|ramallah|west bank)\b/i, 'PS'],
  [/\bsyria\b|\b(damascus|aleppo)\b/i, 'SY'],
  [/\biran\b|\btehran\b/i, 'IR'],
  [/\bkazakhstan\b|\b(almaty|astana|nur-sultan)\b/i, 'KZ'],
  [/\bazerbaijan\b|\bbaku\b/i, 'AZ'],
  [/\blaos\b|\bvientiane\b/i, 'LA'],
  [/\bcambodia\b|\bphnom penh\b/i, 'KH'],
  [/\bmyanmar\b|\b(yangon|naypyidaw)\b/i, 'MM'],
  [/\brwanda\b|\bkigali\b/i, 'RW'],
  [/\bsenegal\b|\bdakar\b/i, 'SN'],
  [/\bmadagascar\b|\bantananarivo\b/i, 'MG'],
  [/\bmali\b|\bbamako\b/i, 'ML'],
  [/\bzambia\b|\blusaka\b/i, 'ZM'],
  [/\bburundi\b|\bbujumbura\b/i, 'BI'],
  [/\bcongo\b|\bbrazzaville\b/i, 'CG'],
  // Spelling/region variants — added 2026-06-19 after target candidates fell to UNKNOWN
  // (native spellings, adjectives, distinctive regions). Placed last; none collide with US.
  [/\bitalia\b/i, 'IT'],
  [/\bvenezuel\w*|\bvenezolan\w*/i, 'VE'],
  [/\bcaba\b/i, 'AR'],
  [/\bcundinamarca\b/i, 'CO'],
  [/\bhermosillo\b|\bsonora\b/i, 'MX'],
  [/\bcastilla\b/i, 'ES'],
  [/\bminas gerais\b/i, 'BR'],
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
