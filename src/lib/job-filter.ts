/**
 * Job filtering module - filters out non-target jobs
 * Target audience: digital/tech specialists (developers, designers, marketers, analysts, translators, copywriters, support)
 * Only REMOTE jobs allowed (no ONSITE, no HYBRID)
 */

/**
 * Check if job title indicates non-target audience
 * (medical, food service, retail, physical labor, construction, etc.)
 */
export function isNonTargetJob(title: string): boolean {
  const lowerTitle = title.toLowerCase();

  // Medical / Healthcare roles
  const medicalKeywords = [
    'nurse', 'nursing', ' rn', 'lpn', 'cna',
    'therapist', 'physician', 'doctor', 'dentist',
    'pharmacist', 'veterinar', 'caregiver', 'clinical care',
    'home health', 'medical director', 'healthcare aide',
    'paramedic', 'emt', 'surgical', 'radiology',
  ];

  // Food service / Hospitality
  const foodKeywords = [
    'chef', 'cook ', 'barista', 'dishwasher', 'server',
    'bartender', 'hostess', 'busser', 'kitchen',
    'restaurant', 'food service', 'catering',
  ];

  // Retail / Store
  const retailKeywords = [
    'cashier', 'retail store', 'store associate', 'store manager',
    'retail associate', 'retail manager', 'merchandiser',
    'store clerk', 'shop assistant',
  ];

  // Construction / Trades / Physical labor
  const constructionKeywords = [
    'window installer', 'window technician', 'window sales',
    'door installer', 'door technician', 'doors sales',
    'roofing', 'plumbing', 'plumber',
    'hvac', 'electrician', 'carpenter', 'welder', 'mason',
    'installation manager', 'permit coordinator',
    'field technician', 'field service', 'construction worker',
    'general contractor', 'handyman', 'maintenance technician',
    'auto mechanic', 'automotive repair', 'car mechanic',
  ];

  // Logistics / Warehouse / Drivers
  const logisticsKeywords = [
    'driver', 'delivery driver', 'truck driver', 'cdl',
    'warehouse', 'forklift', 'loader', 'packer', 'picker',
    'shipping', 'receiving', 'dock worker', 'freight',
    'courier', 'dispatcher',
  ];

  // Physical / On-site only roles
  const onsiteKeywords = [
    'receptionist', 'front desk', 'on-site', 'onsite',
    'janitor', 'custodian', 'housekeeper', 'cleaning',
    'security guard', 'security officer', 'bouncer',
    'concierge', 'doorman', 'valet',
  ];

  // Sales (physical/door-to-door, not digital sales)
  const physicalSalesKeywords = [
    'door-to-door', 'door to door', 'd2d sales',
    'event sales representative', 'event marketing manager',
    'canvasser', 'field sales', 'outside sales representative',
    'lead generation representative',
  ];

  // Finance / Accounting (not digital specialists)
  const financeKeywords = [
    'accountant', 'accounting', 'controller', 'controllership',
    'bookkeeper', 'bookkeeping', 'auditor', 'tax preparer',
    'payroll specialist', 'accounts payable', 'accounts receivable',
    'financial controller', 'assistant controller',
    'revenue accountant', 'staff accountant', 'senior accountant',
    'cpa ', ' cpa', 'certified public accountant',
  ];

  // Industry-specific consulting (not tech/digital)
  const industryConsultingKeywords = [
    'life sciences', 'pharmaceutical', 'biotech consultant',
    'healthcare consultant', 'clinical consultant',
    'manufacturing consultant', 'supply chain consultant',
    'oil and gas', 'mining consultant', 'energy consultant',
    'agriculture consultant', 'farming consultant',
  ];

  // Sales operations / Revenue operations (corporate, not digital sales/marketing)
  const corpSalesKeywords = [
    'sales operations', 'revenue operations', 'revops',
    'sales enablement manager', 'field representative',
    'territory manager', 'regional sales director',
    'district manager', 'area manager',
  ];

  const allKeywords = [
    ...medicalKeywords,
    ...foodKeywords,
    ...retailKeywords,
    ...constructionKeywords,
    ...logisticsKeywords,
    ...onsiteKeywords,
    ...physicalSalesKeywords,
    ...financeKeywords,
    ...industryConsultingKeywords,
    ...corpSalesKeywords,
  ];

  return allKeywords.some((keyword) => lowerTitle.includes(keyword));
}

/**
 * Check if location string looks like a physical address (City, State/Country)
 * Examples: "Tampa, FL", "New York, NY", "London, UK", "Berlin, Germany", "New York"
 */
export function isPhysicalLocation(location: string): boolean {
  if (!location || location.trim() === '') return false;

  const loc = location.trim();
  const lowerLoc = loc.toLowerCase();

  // Skip if contains remote indicators
  if (lowerLoc.includes('remote') || lowerLoc.includes('anywhere') || lowerLoc.includes('worldwide') || lowerLoc.includes('wfh') || lowerLoc.includes('work from home')) {
    return false;
  }

  // Common US state abbreviations pattern: "City, ST"
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

  // Standalone country names (without "remote" = physical presence required)
  const physicalCountries = [
    'china', 'japan', 'korea', 'south korea', 'taiwan', 'thailand', 'vietnam',
    'indonesia', 'malaysia', 'philippines', 'india', 'pakistan', 'bangladesh',
    'brazil', 'argentina', 'mexico', 'colombia', 'chile', 'peru',
    'egypt', 'nigeria', 'south africa', 'kenya', 'morocco',
    'turkey', 'saudi arabia', 'uae', 'united arab emirates', 'israel', 'qatar',
    'australia', 'new zealand',
    'russia', 'ukraine', 'poland', 'czech republic', 'romania', 'hungary',
    'portugal', 'greece', 'sweden', 'norway', 'denmark', 'finland',
    'austria', 'switzerland', 'belgium', 'netherlands', 'ireland',
    'france', 'germany', 'italy', 'spain', 'united kingdom', 'uk', 'england',
  ];

  if (physicalCountries.includes(lowerLoc)) return true;

  // Pattern: "City, Country" or "City, Full State Name"
  const cityCountryPattern = /^[A-Za-z\s]+,\s*[A-Za-z\s]+$/;
  if (cityCountryPattern.test(loc)) {
    return true;
  }

  // Pattern: "Country - City" or "State - City" (e.g., "France - Paris", "Massachusetts - Boston")
  const countryDashCityPattern = /^[A-Za-z\s]+ - [A-Za-z\s]+$/;
  if (countryDashCityPattern.test(loc)) {
    return true;
  }

  // Pattern: "State - City" for US (e.g., "California - San Francisco")
  const usStateFullNames = [
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
    'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
    'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
    'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
    'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
    'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina',
    'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
    'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas',
    'utah', 'vermont', 'virginia', 'washington', 'west virginia',
    'wisconsin', 'wyoming',
  ];
  const locParts = lowerLoc.split(' - ');
  if (locParts.length === 2 && usStateFullNames.includes(locParts[0].trim())) {
    return true;
  }

  return false;
}

/**
 * Check if location type requires office presence
 */
export function isNonRemoteLocationType(locationType: string | null | undefined): boolean {
  if (!locationType) return false;
  return locationType === 'ONSITE' || locationType === 'HYBRID';
}

/**
 * Combined filter: returns true if job should be SKIPPED (not target audience)
 */
export function shouldSkipJob(params: {
  title: string;
  location?: string | null;
  locationType?: string | null;
}): { skip: boolean; reason?: string } {
  const { title, location, locationType } = params;

  // Check title for non-target keywords
  if (isNonTargetJob(title)) {
    return { skip: true, reason: 'non-target title' };
  }

  // Check if location type requires office presence
  if (isNonRemoteLocationType(locationType)) {
    return { skip: true, reason: `${locationType} requires office` };
  }

  // Check if location looks like a physical address
  // Always check - locationType might be incorrectly set (e.g. "China" marked as REMOTE)
  if (location && isPhysicalLocation(location)) {
    return { skip: true, reason: 'physical location' };
  }

  return { skip: false };
}
