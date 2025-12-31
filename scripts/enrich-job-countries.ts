/**
 * Script to re-enrich existing jobs with country data
 * Uses improved country extraction from location, description, and company HQ
 *
 * Usage: DATABASE_URL="..." npx tsx scripts/enrich-job-countries.ts [limit]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Comprehensive country mapping (30 countries)
const COUNTRY_MAP: Record<string, string> = {
  // North America
  'usa': 'US', 'united states': 'US', 'u.s.': 'US', 'america': 'US',
  'canada': 'CA', 'canadian': 'CA',
  'mexico': 'MX', 'méxico': 'MX',
  // Western Europe
  'uk': 'GB', 'united kingdom': 'GB', 'britain': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB',
  'germany': 'DE', 'deutschland': 'DE', 'german': 'DE',
  'france': 'FR', 'french': 'FR', 'française': 'FR',
  'netherlands': 'NL', 'holland': 'NL', 'dutch': 'NL', 'nederland': 'NL',
  'belgium': 'BE', 'belgian': 'BE', 'belgique': 'BE',
  'switzerland': 'CH', 'swiss': 'CH', 'schweiz': 'CH', 'suisse': 'CH',
  'austria': 'AT', 'austrian': 'AT', 'österreich': 'AT',
  'ireland': 'IE', 'irish': 'IE', 'eire': 'IE',
  // Southern Europe
  'spain': 'ES', 'spanish': 'ES', 'españa': 'ES',
  'portugal': 'PT', 'portuguese': 'PT',
  'italy': 'IT', 'italian': 'IT', 'italia': 'IT',
  'greece': 'GR', 'greek': 'GR', 'ελλάδα': 'GR', 'hellas': 'GR',
  'croatia': 'HR', 'croatian': 'HR', 'hrvatska': 'HR',
  'slovenia': 'SI', 'slovenian': 'SI', 'slovenija': 'SI',
  // Northern Europe
  'sweden': 'SE', 'swedish': 'SE', 'sverige': 'SE',
  'denmark': 'DK', 'danish': 'DK', 'danmark': 'DK',
  'norway': 'NO', 'norwegian': 'NO', 'norge': 'NO',
  'finland': 'FI', 'finnish': 'FI', 'suomi': 'FI',
  // Eastern Europe
  'poland': 'PL', 'polish': 'PL', 'polska': 'PL',
  'ukraine': 'UA', 'ukrainian': 'UA', 'україна': 'UA',
  'romania': 'RO', 'romanian': 'RO', 'românia': 'RO',
  'czech republic': 'CZ', 'czechia': 'CZ', 'czech': 'CZ', 'česko': 'CZ',
  'hungary': 'HU', 'hungarian': 'HU', 'magyarország': 'HU',
  'bulgaria': 'BG', 'bulgarian': 'BG', 'българия': 'BG',
  'slovakia': 'SK', 'slovak': 'SK', 'slovensko': 'SK',
  'serbia': 'RS', 'serbian': 'RS', 'србија': 'RS',
  'lithuania': 'LT', 'lithuanian': 'LT', 'lietuva': 'LT',
  'latvia': 'LV', 'latvian': 'LV', 'latvija': 'LV',
  'estonia': 'EE', 'estonian': 'EE', 'eesti': 'EE',
  // Asia Pacific
  'australia': 'AU', 'australian': 'AU', 'aussie': 'AU',
  'singapore': 'SG', 'singaporean': 'SG',
  'japan': 'JP', 'japanese': 'JP', '日本': 'JP',
  'india': 'IN', 'indian': 'IN', 'भारत': 'IN',
  // Middle East
  'israel': 'IL', 'israeli': 'IL', 'ישראל': 'IL',
  'uae': 'AE', 'united arab emirates': 'AE', 'dubai': 'AE', 'abu dhabi': 'AE', 'emirates': 'AE',
  // Latin America
  'brazil': 'BR', 'brazilian': 'BR', 'brasil': 'BR',
  'argentina': 'AR', 'argentine': 'AR', 'argentinian': 'AR',
};

// Major cities mapped to countries
const CITY_COUNTRY_MAP: Record<string, string> = {
  // US cities
  'new york': 'US', 'nyc': 'US', 'san francisco': 'US', 'sf': 'US', 'los angeles': 'US', 'la': 'US',
  'chicago': 'US', 'seattle': 'US', 'austin': 'US', 'boston': 'US', 'denver': 'US', 'miami': 'US',
  'atlanta': 'US', 'dallas': 'US', 'houston': 'US', 'phoenix': 'US', 'silicon valley': 'US',
  'san diego': 'US', 'portland': 'US', 'philadelphia': 'US', 'washington dc': 'US', 'dc': 'US',
  // UK cities
  'london': 'GB', 'manchester': 'GB', 'edinburgh': 'GB', 'birmingham': 'GB', 'bristol': 'GB', 'cambridge': 'GB', 'oxford': 'GB',
  // German cities
  'berlin': 'DE', 'munich': 'DE', 'münchen': 'DE', 'hamburg': 'DE', 'frankfurt': 'DE', 'cologne': 'DE', 'köln': 'DE', 'düsseldorf': 'DE',
  // French cities
  'paris': 'FR', 'lyon': 'FR', 'marseille': 'FR', 'toulouse': 'FR', 'bordeaux': 'FR', 'nantes': 'FR',
  // Dutch cities
  'amsterdam': 'NL', 'rotterdam': 'NL', 'utrecht': 'NL', 'eindhoven': 'NL', 'the hague': 'NL',
  // Spanish cities
  'barcelona': 'ES', 'madrid': 'ES', 'valencia': 'ES', 'seville': 'ES', 'malaga': 'ES', 'bilbao': 'ES',
  // Italian cities
  'milan': 'IT', 'milano': 'IT', 'rome': 'IT', 'roma': 'IT', 'turin': 'IT', 'florence': 'IT', 'bologna': 'IT',
  // Canadian cities
  'toronto': 'CA', 'vancouver': 'CA', 'montreal': 'CA', 'ottawa': 'CA', 'calgary': 'CA', 'waterloo': 'CA',
  // Australian cities
  'sydney': 'AU', 'melbourne': 'AU', 'brisbane': 'AU', 'perth': 'AU', 'adelaide': 'AU',
  // Indian cities
  'bangalore': 'IN', 'bengaluru': 'IN', 'mumbai': 'IN', 'delhi': 'IN', 'new delhi': 'IN', 'hyderabad': 'IN', 'pune': 'IN', 'chennai': 'IN',
  // Other European cities
  'tel aviv': 'IL', 'warsaw': 'PL', 'krakow': 'PL', 'kraków': 'PL', 'wroclaw': 'PL', 'gdansk': 'PL',
  'lisbon': 'PT', 'porto': 'PT',
  'stockholm': 'SE', 'gothenburg': 'SE', 'malmö': 'SE',
  'copenhagen': 'DK', 'aarhus': 'DK',
  'oslo': 'NO', 'bergen': 'NO',
  'helsinki': 'FI', 'tampere': 'FI',
  'zurich': 'CH', 'zürich': 'CH', 'geneva': 'CH', 'basel': 'CH', 'bern': 'CH',
  'vienna': 'AT', 'wien': 'AT', 'salzburg': 'AT', 'graz': 'AT',
  'brussels': 'BE', 'antwerp': 'BE', 'ghent': 'BE',
  'dublin': 'IE', 'cork': 'IE', 'galway': 'IE',
  'prague': 'CZ', 'praha': 'CZ', 'brno': 'CZ',
  'bucharest': 'RO', 'cluj': 'RO', 'timisoara': 'RO',
  'kyiv': 'UA', 'kiev': 'UA', 'lviv': 'UA', 'kharkiv': 'UA',
  // Greek cities
  'athens': 'GR', 'thessaloniki': 'GR', 'patras': 'GR',
  // Hungarian cities
  'budapest': 'HU', 'debrecen': 'HU',
  // Bulgarian cities
  'sofia': 'BG', 'plovdiv': 'BG', 'varna': 'BG',
  // Other Eastern European
  'bratislava': 'SK', 'belgrade': 'RS', 'zagreb': 'HR', 'ljubljana': 'SI',
  'vilnius': 'LT', 'riga': 'LV', 'tallinn': 'EE',
  // Asian cities
  'tokyo': 'JP', 'osaka': 'JP', 'kyoto': 'JP',
  // Latin American cities
  'são paulo': 'BR', 'sao paulo': 'BR', 'rio de janeiro': 'BR', 'rio': 'BR',
  'buenos aires': 'AR', 'mexico city': 'MX', 'ciudad de méxico': 'MX',
};

// US state names and abbreviations
const US_STATES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california',
  'colorado', 'connecticut', 'delaware', 'florida', 'georgia',
  'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
  'kansas', 'kentucky', 'louisiana', 'maine', 'maryland',
  'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri',
  'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey',
  'new mexico', 'north carolina', 'north dakota', 'ohio',
  'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina',
  'south dakota', 'tennessee', 'texas', 'utah', 'vermont',
  'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming',
];

const US_STATE_ABBR = [
  'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga',
  'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md',
  'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj',
  'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc',
  'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy',
];

function extractCountryFromText(text: string): string | null {
  const normalized = text.toLowerCase();

  // Check country names first
  for (const [key, code] of Object.entries(COUNTRY_MAP)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(normalized)) {
      return code;
    }
  }

  // Check city names
  for (const [city, code] of Object.entries(CITY_COUNTRY_MAP)) {
    const regex = new RegExp(`\\b${city}\\b`, 'i');
    if (regex.test(normalized)) {
      return code;
    }
  }

  // Check US states (full names)
  for (const state of US_STATES) {
    const regex = new RegExp(`\\b${state}\\b`, 'i');
    if (regex.test(normalized)) {
      return 'US';
    }
  }

  // Check US state abbreviations (require comma before to avoid false positives)
  for (const abbr of US_STATE_ABBR) {
    if (normalized.includes(`, ${abbr}`) || normalized.includes(`,${abbr}`)) {
      return 'US';
    }
  }

  return null;
}

function extractCountryCode(location: string | null, description: string | null, headquarters: string | null): string | null {
  // Priority 1: Location field
  if (location) {
    const code = extractCountryFromText(location);
    if (code) return code;
  }

  // Priority 2: Company headquarters
  if (headquarters) {
    const code = extractCountryFromText(headquarters);
    if (code) return code;
  }

  // Priority 3: Description (first 500 chars only)
  if (description) {
    const code = extractCountryFromText(description.slice(0, 500));
    if (code) return code;
  }

  return null;
}

async function main() {
  const limit = parseInt(process.argv[2] || '1000', 10);

  console.log(`Enriching jobs with country data (limit: ${limit})...`);

  // Get jobs without country
  const jobs = await prisma.job.findMany({
    where: {
      country: null,
      isActive: true,
    },
    include: {
      company: {
        select: { headquarters: true },
      },
    },
    take: limit,
  });

  console.log(`Found ${jobs.length} jobs without country`);

  let enriched = 0;
  let skipped = 0;
  const countryCounts: Record<string, number> = {};

  for (const job of jobs) {
    const countryCode = extractCountryCode(
      job.location,
      job.description,
      job.company.headquarters
    );

    if (countryCode) {
      await prisma.job.update({
        where: { id: job.id },
        data: { country: countryCode },
      });
      enriched++;
      countryCounts[countryCode] = (countryCounts[countryCode] || 0) + 1;

      if (enriched % 50 === 0) {
        console.log(`Progress: ${enriched}/${jobs.length} enriched`);
      }
    } else {
      skipped++;
    }
  }

  console.log('\n=== RESULTS ===');
  console.log(`Total processed: ${jobs.length}`);
  console.log(`Enriched: ${enriched}`);
  console.log(`Skipped (no country found): ${skipped}`);

  console.log('\nCountry distribution:');
  const sorted = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
  for (const [code, count] of sorted) {
    console.log(`  ${code}: ${count}`);
  }

  // Final stats
  const totalWithCountry = await prisma.job.count({
    where: { isActive: true, country: { not: null } },
  });
  const totalActive = await prisma.job.count({
    where: { isActive: true },
  });

  console.log(`\nFinal coverage: ${totalWithCountry}/${totalActive} (${Math.round(totalWithCountry / totalActive * 100)}%)`);

  await prisma.$disconnect();
}

main().catch(console.error);
