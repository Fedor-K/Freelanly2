/**
 * Script to fix jobs where location city doesn't match country
 * Example: Athens job with country=BE (Belgium) should be country=GR (Greece)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cities that should override HQ-based country
const CITY_COUNTRY_MAP: Record<string, string> = {
  // Greek cities
  'athens': 'GR', 'thessaloniki': 'GR', 'patras': 'GR',
  // Hungarian cities
  'budapest': 'HU', 'debrecen': 'HU',
  // Bulgarian cities
  'sofia': 'BG', 'plovdiv': 'BG', 'varna': 'BG',
  // Other Eastern European
  'bratislava': 'SK', 'belgrade': 'RS', 'zagreb': 'HR', 'ljubljana': 'SI',
  'vilnius': 'LT', 'riga': 'LV', 'tallinn': 'EE',
  // UK cities
  'london': 'GB', 'manchester': 'GB', 'edinburgh': 'GB', 'birmingham': 'GB', 'bristol': 'GB',
  // German cities
  'berlin': 'DE', 'munich': 'DE', 'münchen': 'DE', 'hamburg': 'DE', 'frankfurt': 'DE', 'cologne': 'DE', 'düsseldorf': 'DE',
  // French cities
  'paris': 'FR', 'lyon': 'FR', 'marseille': 'FR', 'toulouse': 'FR', 'bordeaux': 'FR',
  // Dutch cities
  'amsterdam': 'NL', 'rotterdam': 'NL', 'utrecht': 'NL', 'eindhoven': 'NL', 'the hague': 'NL',
  // Spanish cities
  'barcelona': 'ES', 'madrid': 'ES', 'valencia': 'ES', 'seville': 'ES', 'malaga': 'ES',
  // Italian cities
  'milan': 'IT', 'milano': 'IT', 'rome': 'IT', 'roma': 'IT', 'turin': 'IT', 'florence': 'IT',
  // Swiss cities
  'zurich': 'CH', 'zürich': 'CH', 'geneva': 'CH', 'basel': 'CH', 'bern': 'CH',
  // Austrian cities
  'vienna': 'AT', 'wien': 'AT', 'salzburg': 'AT', 'graz': 'AT',
  // Belgian cities
  'brussels': 'BE', 'antwerp': 'BE', 'ghent': 'BE',
  // Irish cities
  'dublin': 'IE', 'cork': 'IE', 'galway': 'IE',
  // Czech cities
  'prague': 'CZ', 'praha': 'CZ', 'brno': 'CZ',
  // Romanian cities
  'bucharest': 'RO', 'cluj': 'RO', 'timisoara': 'RO',
  // Ukrainian cities
  'kyiv': 'UA', 'kiev': 'UA', 'lviv': 'UA', 'kharkiv': 'UA',
  // Polish cities
  'warsaw': 'PL', 'krakow': 'PL', 'kraków': 'PL', 'wroclaw': 'PL', 'gdansk': 'PL',
  // Portuguese cities
  'lisbon': 'PT', 'porto': 'PT',
  // Scandinavian cities
  'stockholm': 'SE', 'gothenburg': 'SE', 'malmö': 'SE',
  'copenhagen': 'DK', 'aarhus': 'DK',
  'oslo': 'NO', 'bergen': 'NO',
  'helsinki': 'FI', 'tampere': 'FI',
};

async function main() {
  console.log('Fixing jobs with mismatched location/country...\n');

  const jobs = await prisma.job.findMany({
    where: {
      isActive: true,
      location: { not: null }
    },
    select: { id: true, title: true, location: true, country: true }
  });

  let fixed = 0;
  const fixes: Array<{ title: string; location: string; was: string | null; now: string }> = [];

  for (const job of jobs) {
    if (!job.location) continue;
    const loc = job.location.toLowerCase();

    for (const [city, correctCode] of Object.entries(CITY_COUNTRY_MAP)) {
      // Use word boundary check to avoid partial matches
      const regex = new RegExp(`\\b${city}\\b`, 'i');
      if (regex.test(loc) && job.country !== correctCode) {
        fixes.push({
          title: job.title.slice(0, 40),
          location: job.location,
          was: job.country,
          now: correctCode
        });

        await prisma.job.update({
          where: { id: job.id },
          data: { country: correctCode }
        });

        fixed++;
        break;
      }
    }
  }

  console.log(`Fixed ${fixed} jobs:\n`);
  for (const f of fixes) {
    console.log(`  ${f.title}`);
    console.log(`    Location: ${f.location}`);
    console.log(`    Country: ${f.was || 'null'} → ${f.now}\n`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
