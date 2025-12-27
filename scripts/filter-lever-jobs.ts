import { prisma } from '../src/lib/db';

function isNonTargetJob(title: string): boolean {
  const lowerTitle = title.toLowerCase();

  const allKeywords = [
    // Medical
    'nurse', 'nursing', ' rn', 'lpn', 'cna',
    'therapist', 'physician', 'doctor', 'dentist',
    'pharmacist', 'veterinar', 'caregiver', 'clinical care',
    'home health', 'medical director', 'healthcare aide',
    'paramedic', 'emt', 'surgical', 'radiology',
    // Food
    'chef', 'cook ', 'barista', 'dishwasher', 'server',
    'bartender', 'hostess', 'busser', 'kitchen',
    'restaurant', 'food service', 'catering',
    // Retail
    'cashier', 'retail store', 'store associate', 'store manager',
    'retail associate', 'retail manager', 'merchandiser',
    'store clerk', 'shop assistant',
    // Construction
    'window installer', 'window technician', 'window sales',
    'door installer', 'door technician', 'doors sales',
    'roofing', 'plumbing', 'plumber',
    'hvac', 'electrician', 'carpenter', 'welder', 'mason',
    'installation manager', 'permit coordinator',
    'field technician', 'field service', 'construction worker',
    'general contractor', 'handyman', 'maintenance technician',
    'auto mechanic', 'automotive repair', 'car mechanic',
    // Logistics
    'driver', 'delivery driver', 'truck driver', 'cdl',
    'warehouse', 'forklift', 'loader', 'packer', 'picker',
    'shipping', 'receiving', 'dock worker', 'freight',
    'courier', 'dispatcher',
    // Onsite
    'receptionist', 'front desk', 'on-site', 'onsite',
    'janitor', 'custodian', 'housekeeper', 'cleaning',
    'security guard', 'security officer', 'bouncer',
    'concierge', 'doorman', 'valet',
    // Physical sales
    'door-to-door', 'door to door', 'd2d sales',
    'event sales representative', 'event marketing manager',
    'canvasser', 'field sales', 'outside sales representative',
    'lead generation representative',
  ];

  return allKeywords.some((keyword) => lowerTitle.includes(keyword));
}

function isPhysicalLocation(location: string): boolean {
  if (!location || location.trim() === '') return false;

  const loc = location.trim();
  const lowerLoc = loc.toLowerCase();

  // Skip if contains remote indicators
  if (lowerLoc.includes('remote') || lowerLoc.includes('anywhere') || lowerLoc.includes('worldwide') || lowerLoc.includes('wfh') || lowerLoc.includes('work from home')) {
    return false;
  }

  // US state abbreviations
  const usStates = /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$/i;
  if (usStates.test(loc)) return true;

  // Known major cities (without state/country suffix)
  const knownCities = [
    // US
    'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
    'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'san francisco',
    'seattle', 'denver', 'boston', 'atlanta', 'miami', 'portland', 'las vegas',
    'detroit', 'minneapolis', 'tampa', 'orlando', 'charlotte', 'pittsburgh',
    // Europe
    'london', 'paris', 'berlin', 'madrid', 'rome', 'amsterdam', 'barcelona',
    'munich', 'milan', 'vienna', 'prague', 'warsaw', 'budapest', 'dublin',
    'lisbon', 'stockholm', 'copenhagen', 'oslo', 'helsinki', 'zurich', 'geneva',
    'brussels', 'vilnius', 'kaunas', 'riga', 'tallinn',
    // Asia
    'tokyo', 'singapore', 'hong kong', 'shanghai', 'beijing', 'seoul', 'mumbai',
    'bangalore', 'delhi', 'pune', 'hyderabad', 'chennai',
    // Other
    'sydney', 'melbourne', 'toronto', 'vancouver', 'montreal', 'dubai', 'tel aviv',
    'cape town', 'johannesburg', 'sao paulo', 'mexico city', 'buenos aires',
  ];

  if (knownCities.includes(lowerLoc)) return true;

  // City, Country pattern
  const cityCountryPattern = /^[A-Za-z\s]+,\s*[A-Za-z\s]+$/;
  if (cityCountryPattern.test(loc)) {
    return true;
  }

  return false;
}

async function main() {
  // Get all LEVER jobs
  const leverJobs = await prisma.job.findMany({
    where: { source: 'LEVER' },
    select: {
      id: true,
      title: true,
      location: true,
      locationType: true,
      company: { select: { name: true } }
    }
  });

  console.log('Total LEVER jobs:', leverJobs.length);

  const toDelete: { id: string; title: string; location: string | null; reason: string; company: string }[] = [];

  for (const job of leverJobs) {
    // Check title filter
    if (isNonTargetJob(job.title)) {
      toDelete.push({
        id: job.id,
        title: job.title,
        location: job.location,
        reason: 'non-target title',
        company: job.company.name
      });
      continue;
    }

    // Filter HYBRID jobs - they require office presence
    if (job.locationType === 'HYBRID') {
      toDelete.push({
        id: job.id,
        title: job.title,
        location: job.location,
        reason: 'HYBRID (requires office)',
        company: job.company.name
      });
      continue;
    }

    // Check location filter (only if not already marked as remote)
    if (job.locationType !== 'REMOTE' && job.locationType !== 'REMOTE_US' && job.locationType !== 'REMOTE_EU') {
      if (isPhysicalLocation(job.location || '')) {
        toDelete.push({
          id: job.id,
          title: job.title,
          location: job.location,
          reason: 'physical location',
          company: job.company.name
        });
      }
    }
  }

  console.log('\nJobs to delete:', toDelete.length);
  console.log('\n=== JOBS TO DELETE ===');
  toDelete.forEach(j => {
    console.log(`[${j.reason}] ${j.company}: ${j.title} (${j.location})`);
  });

  if (toDelete.length > 0) {
    const deleted = await prisma.job.deleteMany({
      where: { id: { in: toDelete.map(j => j.id) } }
    });
    console.log(`\nDeleted ${deleted.count} jobs`);
  } else {
    console.log('\nNo jobs to delete');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
