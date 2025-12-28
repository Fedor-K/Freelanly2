/**
 * Job filtering module - filters jobs based on target professions
 *
 * NEW APPROACH (Dec 2024):
 * - WHITELIST: Only import jobs matching target professions
 * - Location type (remote/hybrid/onsite) is NO LONGER a filter
 * - All location types are imported if profession matches
 * - Users can filter by location type on the frontend
 *
 * Target audience: tech/digital professionals
 */

import { shouldImportByProfession } from '@/config/target-professions';

/**
 * Check if location string looks like a physical address
 * Used for extracting country code, NOT for filtering
 */
export function isPhysicalLocation(location: string): boolean {
  if (!location || location.trim() === '') return false;

  const loc = location.trim();
  const lowerLoc = loc.toLowerCase();

  // Skip if contains remote indicators
  if (
    lowerLoc.includes('remote') ||
    lowerLoc.includes('anywhere') ||
    lowerLoc.includes('worldwide') ||
    lowerLoc.includes('wfh') ||
    lowerLoc.includes('work from home')
  ) {
    return false;
  }

  // Common US state abbreviations pattern: "City, ST"
  const usStates =
    /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$/i;
  if (usStates.test(loc)) return true;

  // Known major cities
  const knownCities = [
    // US
    'new york',
    'los angeles',
    'chicago',
    'houston',
    'phoenix',
    'philadelphia',
    'san antonio',
    'san diego',
    'dallas',
    'san jose',
    'austin',
    'san francisco',
    'seattle',
    'denver',
    'boston',
    'atlanta',
    'miami',
    'portland',
    'las vegas',
    'detroit',
    'minneapolis',
    'tampa',
    'orlando',
    'charlotte',
    'pittsburgh',
    // Europe
    'london',
    'paris',
    'berlin',
    'madrid',
    'rome',
    'amsterdam',
    'barcelona',
    'munich',
    'milan',
    'vienna',
    'prague',
    'warsaw',
    'budapest',
    'dublin',
    'lisbon',
    'stockholm',
    'copenhagen',
    'oslo',
    'helsinki',
    'zurich',
    'geneva',
    'brussels',
    'vilnius',
    'kaunas',
    'riga',
    'tallinn',
    'minsk',
    'tbilisi',
    'kyiv',
    'kharkiv',
    // Asia
    'tokyo',
    'singapore',
    'hong kong',
    'shanghai',
    'beijing',
    'seoul',
    'mumbai',
    'bangalore',
    'delhi',
    'pune',
    'hyderabad',
    'chennai',
    'noida',
    'gurgaon',
    // Other
    'sydney',
    'melbourne',
    'toronto',
    'vancouver',
    'montreal',
    'dubai',
    'tel aviv',
    'cape town',
    'johannesburg',
    'sao paulo',
    'mexico city',
    'buenos aires',
  ];

  if (knownCities.includes(lowerLoc)) return true;

  // Pattern: "City, Country" or "City, State"
  const cityCountryPattern = /^[A-Za-z\s]+,\s*[A-Za-z\s]+$/;
  if (cityCountryPattern.test(loc)) return true;

  return false;
}

/**
 * Legacy function - kept for backwards compatibility
 * @deprecated Use shouldImportByProfession instead
 */
export function isNonTargetJob(title: string): boolean {
  return !shouldImportByProfession(title);
}

/**
 * Legacy function - no longer used for filtering
 * Location type is now informational only
 */
export function isNonRemoteLocationType(locationType: string | null | undefined): boolean {
  if (!locationType) return false;
  return locationType === 'ONSITE' || locationType === 'HYBRID';
}

/**
 * Main filter function: returns true if job should be SKIPPED
 *
 * NEW LOGIC:
 * - Only checks if profession is in whitelist
 * - Does NOT filter by location type anymore
 * - Hybrid/Onsite jobs with matching professions are imported
 */
export function shouldSkipJob(params: {
  title: string;
  location?: string | null;
  locationType?: string | null;
}): { skip: boolean; reason?: string } {
  const { title } = params;

  // Check if profession matches our target audience
  if (!shouldImportByProfession(title)) {
    return { skip: true, reason: 'non-target profession' };
  }

  // Location type is NO LONGER a filter
  // All location types (remote, hybrid, onsite) are now imported

  return { skip: false };
}
