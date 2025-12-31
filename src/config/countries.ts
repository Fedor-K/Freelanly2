/**
 * Countries configuration for programmatic SEO pages
 * Used for /jobs/[category]/country/[country] routes
 */

export interface Country {
  code: string;      // ISO 3166-1 alpha-2
  slug: string;      // URL slug
  name: string;      // Full name
  flag: string;      // Emoji flag
  region: string;    // Geographic region
  timezone: string;  // Primary timezone description
  currency: string;  // Primary currency code
}

export const countries: Country[] = [
  // North America
  { code: 'US', slug: 'usa', name: 'United States', flag: '🇺🇸', region: 'North America', timezone: 'UTC-5 to UTC-8', currency: 'USD' },
  { code: 'CA', slug: 'canada', name: 'Canada', flag: '🇨🇦', region: 'North America', timezone: 'UTC-4 to UTC-8', currency: 'CAD' },
  { code: 'MX', slug: 'mexico', name: 'Mexico', flag: '🇲🇽', region: 'North America', timezone: 'UTC-6 to UTC-8', currency: 'MXN' },

  // Western Europe
  { code: 'GB', slug: 'united-kingdom', name: 'United Kingdom', flag: '🇬🇧', region: 'Western Europe', timezone: 'UTC+0', currency: 'GBP' },
  { code: 'DE', slug: 'germany', name: 'Germany', flag: '🇩🇪', region: 'Western Europe', timezone: 'UTC+1', currency: 'EUR' },
  { code: 'FR', slug: 'france', name: 'France', flag: '🇫🇷', region: 'Western Europe', timezone: 'UTC+1', currency: 'EUR' },
  { code: 'NL', slug: 'netherlands', name: 'Netherlands', flag: '🇳🇱', region: 'Western Europe', timezone: 'UTC+1', currency: 'EUR' },
  { code: 'BE', slug: 'belgium', name: 'Belgium', flag: '🇧🇪', region: 'Western Europe', timezone: 'UTC+1', currency: 'EUR' },
  { code: 'CH', slug: 'switzerland', name: 'Switzerland', flag: '🇨🇭', region: 'Western Europe', timezone: 'UTC+1', currency: 'CHF' },
  { code: 'AT', slug: 'austria', name: 'Austria', flag: '🇦🇹', region: 'Western Europe', timezone: 'UTC+1', currency: 'EUR' },
  { code: 'IE', slug: 'ireland', name: 'Ireland', flag: '🇮🇪', region: 'Western Europe', timezone: 'UTC+0', currency: 'EUR' },

  // Southern Europe
  { code: 'ES', slug: 'spain', name: 'Spain', flag: '🇪🇸', region: 'Southern Europe', timezone: 'UTC+1', currency: 'EUR' },
  { code: 'PT', slug: 'portugal', name: 'Portugal', flag: '🇵🇹', region: 'Southern Europe', timezone: 'UTC+0', currency: 'EUR' },
  { code: 'IT', slug: 'italy', name: 'Italy', flag: '🇮🇹', region: 'Southern Europe', timezone: 'UTC+1', currency: 'EUR' },

  // Northern Europe
  { code: 'SE', slug: 'sweden', name: 'Sweden', flag: '🇸🇪', region: 'Northern Europe', timezone: 'UTC+1', currency: 'SEK' },
  { code: 'DK', slug: 'denmark', name: 'Denmark', flag: '🇩🇰', region: 'Northern Europe', timezone: 'UTC+1', currency: 'DKK' },
  { code: 'NO', slug: 'norway', name: 'Norway', flag: '🇳🇴', region: 'Northern Europe', timezone: 'UTC+1', currency: 'NOK' },
  { code: 'FI', slug: 'finland', name: 'Finland', flag: '🇫🇮', region: 'Northern Europe', timezone: 'UTC+2', currency: 'EUR' },

  // Eastern Europe
  { code: 'PL', slug: 'poland', name: 'Poland', flag: '🇵🇱', region: 'Eastern Europe', timezone: 'UTC+1', currency: 'PLN' },
  { code: 'UA', slug: 'ukraine', name: 'Ukraine', flag: '🇺🇦', region: 'Eastern Europe', timezone: 'UTC+2', currency: 'UAH' },
  { code: 'RO', slug: 'romania', name: 'Romania', flag: '🇷🇴', region: 'Eastern Europe', timezone: 'UTC+2', currency: 'RON' },
  { code: 'CZ', slug: 'czechia', name: 'Czech Republic', flag: '🇨🇿', region: 'Eastern Europe', timezone: 'UTC+1', currency: 'CZK' },

  // Asia Pacific
  { code: 'AU', slug: 'australia', name: 'Australia', flag: '🇦🇺', region: 'Asia Pacific', timezone: 'UTC+8 to UTC+11', currency: 'AUD' },
  { code: 'SG', slug: 'singapore', name: 'Singapore', flag: '🇸🇬', region: 'Asia Pacific', timezone: 'UTC+8', currency: 'SGD' },
  { code: 'JP', slug: 'japan', name: 'Japan', flag: '🇯🇵', region: 'Asia Pacific', timezone: 'UTC+9', currency: 'JPY' },
  { code: 'IN', slug: 'india', name: 'India', flag: '🇮🇳', region: 'Asia Pacific', timezone: 'UTC+5:30', currency: 'INR' },

  // Middle East
  { code: 'IL', slug: 'israel', name: 'Israel', flag: '🇮🇱', region: 'Middle East', timezone: 'UTC+2', currency: 'ILS' },
  { code: 'AE', slug: 'uae', name: 'United Arab Emirates', flag: '🇦🇪', region: 'Middle East', timezone: 'UTC+4', currency: 'AED' },

  // Latin America
  { code: 'BR', slug: 'brazil', name: 'Brazil', flag: '🇧🇷', region: 'Latin America', timezone: 'UTC-3 to UTC-5', currency: 'BRL' },
  { code: 'AR', slug: 'argentina', name: 'Argentina', flag: '🇦🇷', region: 'Latin America', timezone: 'UTC-3', currency: 'ARS' },
];

/**
 * Get country by slug
 */
export function getCountryBySlug(slug: string): Country | undefined {
  return countries.find(c => c.slug === slug);
}

/**
 * Get country by code
 */
export function getCountryByCode(code: string): Country | undefined {
  return countries.find(c => c.code === code);
}

/**
 * Get countries by region
 */
export function getCountriesByRegion(region: string): Country[] {
  return countries.filter(c => c.region === region);
}

/**
 * Get all country slugs (for generateStaticParams)
 */
export function getAllCountrySlugs(): string[] {
  return countries.map(c => c.slug);
}

/**
 * High-volume countries (always index even with fewer jobs)
 */
export const highVolumeCountries = ['usa', 'united-kingdom', 'germany', 'canada', 'netherlands'];

/**
 * Check if a country is high-volume
 */
export function isHighVolumeCountry(slug: string): boolean {
  return highVolumeCountries.includes(slug);
}
