/**
 * Salary Coefficients for Remote Job Salary Estimation
 *
 * Used to estimate salaries using the formula:
 * Annual Salary = BaseSalary[category] × LevelMultiplier[level] × CountryCoefficient[country]
 *
 * Based on:
 * - Levels.fyi, Glassdoor, LinkedIn Salary Insights
 * - Cost of living indices
 * - Remote work salary surveys (Dec 2024)
 */

// ============================================================================
// LEVEL MULTIPLIERS
// ============================================================================

/**
 * Level multipliers relative to Mid-level (Mid = 1.0)
 * Applied to category base salary to get level-adjusted salary
 */
export const LEVEL_MULTIPLIERS: Record<string, number> = {
  INTERN: 0.30,
  ENTRY: 0.50,
  JUNIOR: 0.65,
  MID: 1.00,
  SENIOR: 1.30,
  LEAD: 1.50,
  MANAGER: 1.60,
  DIRECTOR: 2.00,
  EXECUTIVE: 2.80,
};

export const DEFAULT_LEVEL_MULTIPLIER = 1.0; // Mid-level default

/**
 * Get level multiplier
 */
export function getLevelMultiplier(level: string | null | undefined): number {
  if (!level) return DEFAULT_LEVEL_MULTIPLIER;
  return LEVEL_MULTIPLIERS[level.toUpperCase()] ?? DEFAULT_LEVEL_MULTIPLIER;
}

// ============================================================================
// COUNTRY COEFFICIENTS
// ============================================================================

export interface CountryCoefficient {
  name: string;
  coefficient: number;  // Relative to US (1.0)
  currency: string;
  currencySymbol: string;
  // Approximate USD conversion rate
  usdRate: number;
}

// Salary coefficients by country (relative to US)
// US = 1.0 baseline
export const COUNTRY_COEFFICIENTS: Record<string, CountryCoefficient> = {
  // North America
  'US': { name: 'United States', coefficient: 1.0, currency: 'USD', currencySymbol: '$', usdRate: 1.0 },
  'CA': { name: 'Canada', coefficient: 0.65, currency: 'CAD', currencySymbol: 'C$', usdRate: 0.74 },
  'MX': { name: 'Mexico', coefficient: 0.25, currency: 'MXN', currencySymbol: '$', usdRate: 0.058 },

  // Western Europe (high)
  'CH': { name: 'Switzerland', coefficient: 0.88, currency: 'CHF', currencySymbol: 'CHF', usdRate: 1.13 },
  'GB': { name: 'United Kingdom', coefficient: 0.75, currency: 'GBP', currencySymbol: '£', usdRate: 1.27 },
  'UK': { name: 'United Kingdom', coefficient: 0.75, currency: 'GBP', currencySymbol: '£', usdRate: 1.27 },
  'DE': { name: 'Germany', coefficient: 0.70, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'NL': { name: 'Netherlands', coefficient: 0.68, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'IE': { name: 'Ireland', coefficient: 0.72, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'BE': { name: 'Belgium', coefficient: 0.65, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'LU': { name: 'Luxembourg', coefficient: 0.80, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'AT': { name: 'Austria', coefficient: 0.65, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'FR': { name: 'France', coefficient: 0.60, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },

  // Northern Europe
  'SE': { name: 'Sweden', coefficient: 0.65, currency: 'SEK', currencySymbol: 'kr', usdRate: 0.095 },
  'NO': { name: 'Norway', coefficient: 0.72, currency: 'NOK', currencySymbol: 'kr', usdRate: 0.093 },
  'DK': { name: 'Denmark', coefficient: 0.68, currency: 'DKK', currencySymbol: 'kr', usdRate: 0.145 },
  'FI': { name: 'Finland', coefficient: 0.58, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },

  // Southern Europe
  'ES': { name: 'Spain', coefficient: 0.48, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'IT': { name: 'Italy', coefficient: 0.52, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'PT': { name: 'Portugal', coefficient: 0.45, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'GR': { name: 'Greece', coefficient: 0.38, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },

  // Eastern Europe
  'PL': { name: 'Poland', coefficient: 0.35, currency: 'PLN', currencySymbol: 'zł', usdRate: 0.25 },
  'CZ': { name: 'Czech Republic', coefficient: 0.40, currency: 'CZK', currencySymbol: 'Kč', usdRate: 0.044 },
  'RO': { name: 'Romania', coefficient: 0.32, currency: 'RON', currencySymbol: 'lei', usdRate: 0.22 },
  'HU': { name: 'Hungary', coefficient: 0.32, currency: 'HUF', currencySymbol: 'Ft', usdRate: 0.0028 },
  'UA': { name: 'Ukraine', coefficient: 0.25, currency: 'UAH', currencySymbol: '₴', usdRate: 0.024 },
  'RU': { name: 'Russia', coefficient: 0.30, currency: 'RUB', currencySymbol: '₽', usdRate: 0.011 },
  'BY': { name: 'Belarus', coefficient: 0.25, currency: 'BYN', currencySymbol: 'Br', usdRate: 0.31 },

  // Baltic
  'EE': { name: 'Estonia', coefficient: 0.45, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'LV': { name: 'Latvia', coefficient: 0.38, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'LT': { name: 'Lithuania', coefficient: 0.38, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },

  // Asia-Pacific (high)
  'AU': { name: 'Australia', coefficient: 0.68, currency: 'AUD', currencySymbol: 'A$', usdRate: 0.65 },
  'NZ': { name: 'New Zealand', coefficient: 0.58, currency: 'NZD', currencySymbol: 'NZ$', usdRate: 0.61 },
  'SG': { name: 'Singapore', coefficient: 0.72, currency: 'SGD', currencySymbol: 'S$', usdRate: 0.74 },
  'HK': { name: 'Hong Kong', coefficient: 0.65, currency: 'HKD', currencySymbol: 'HK$', usdRate: 0.13 },
  'JP': { name: 'Japan', coefficient: 0.55, currency: 'JPY', currencySymbol: '¥', usdRate: 0.0067 },
  'KR': { name: 'South Korea', coefficient: 0.50, currency: 'KRW', currencySymbol: '₩', usdRate: 0.00075 },
  'TW': { name: 'Taiwan', coefficient: 0.45, currency: 'TWD', currencySymbol: 'NT$', usdRate: 0.031 },

  // Asia (developing)
  'IN': { name: 'India', coefficient: 0.20, currency: 'INR', currencySymbol: '₹', usdRate: 0.012 },
  'PK': { name: 'Pakistan', coefficient: 0.18, currency: 'PKR', currencySymbol: 'Rs', usdRate: 0.0036 },
  'PH': { name: 'Philippines', coefficient: 0.22, currency: 'PHP', currencySymbol: '₱', usdRate: 0.018 },
  'ID': { name: 'Indonesia', coefficient: 0.18, currency: 'IDR', currencySymbol: 'Rp', usdRate: 0.000063 },
  'VN': { name: 'Vietnam', coefficient: 0.22, currency: 'VND', currencySymbol: '₫', usdRate: 0.000040 },
  'TH': { name: 'Thailand', coefficient: 0.28, currency: 'THB', currencySymbol: '฿', usdRate: 0.029 },
  'MY': { name: 'Malaysia', coefficient: 0.32, currency: 'MYR', currencySymbol: 'RM', usdRate: 0.22 },
  'CN': { name: 'China', coefficient: 0.40, currency: 'CNY', currencySymbol: '¥', usdRate: 0.14 },
  'BD': { name: 'Bangladesh', coefficient: 0.15, currency: 'BDT', currencySymbol: '৳', usdRate: 0.0091 },

  // Middle East
  'IL': { name: 'Israel', coefficient: 0.78, currency: 'ILS', currencySymbol: '₪', usdRate: 0.27 },
  'AE': { name: 'United Arab Emirates', coefficient: 0.65, currency: 'AED', currencySymbol: 'د.إ', usdRate: 0.27 },
  'SA': { name: 'Saudi Arabia', coefficient: 0.55, currency: 'SAR', currencySymbol: '﷼', usdRate: 0.27 },
  'TR': { name: 'Turkey', coefficient: 0.25, currency: 'TRY', currencySymbol: '₺', usdRate: 0.029 },

  // South America
  'BR': { name: 'Brazil', coefficient: 0.28, currency: 'BRL', currencySymbol: 'R$', usdRate: 0.20 },
  'AR': { name: 'Argentina', coefficient: 0.22, currency: 'ARS', currencySymbol: '$', usdRate: 0.0012 },
  'CL': { name: 'Chile', coefficient: 0.35, currency: 'CLP', currencySymbol: '$', usdRate: 0.0011 },
  'CO': { name: 'Colombia', coefficient: 0.25, currency: 'COP', currencySymbol: '$', usdRate: 0.00025 },
  'PE': { name: 'Peru', coefficient: 0.25, currency: 'PEN', currencySymbol: 'S/', usdRate: 0.27 },
  'UY': { name: 'Uruguay', coefficient: 0.32, currency: 'UYU', currencySymbol: '$', usdRate: 0.025 },

  // Africa
  'ZA': { name: 'South Africa', coefficient: 0.30, currency: 'ZAR', currencySymbol: 'R', usdRate: 0.055 },
  'NG': { name: 'Nigeria', coefficient: 0.18, currency: 'NGN', currencySymbol: '₦', usdRate: 0.00065 },
  'KE': { name: 'Kenya', coefficient: 0.18, currency: 'KES', currencySymbol: 'KSh', usdRate: 0.0077 },
  'EG': { name: 'Egypt', coefficient: 0.18, currency: 'EGP', currencySymbol: 'E£', usdRate: 0.032 },
  'MA': { name: 'Morocco', coefficient: 0.22, currency: 'MAD', currencySymbol: 'DH', usdRate: 0.10 },
  'GH': { name: 'Ghana', coefficient: 0.18, currency: 'GHS', currencySymbol: 'GH₵', usdRate: 0.065 },
};

// Default coefficient for unknown countries
export const DEFAULT_COEFFICIENT: CountryCoefficient = {
  name: 'Global Average',
  coefficient: 0.45,  // Default to 45% of US salary (conservative)
  currency: 'USD',
  currencySymbol: '$',
  usdRate: 1.0,
};

/**
 * Get country coefficient
 */
export function getCountryCoefficient(countryCode: string | null | undefined): CountryCoefficient {
  if (!countryCode) {
    return DEFAULT_COEFFICIENT;
  }
  return COUNTRY_COEFFICIENTS[countryCode.toUpperCase()] || DEFAULT_COEFFICIENT;
}

/**
 * Estimate salary for a country based on US baseline
 */
export function estimateSalaryForCountry(
  usSalary: number,
  countryCode: string
): { localAmount: number; usdAmount: number; currency: string } {
  const country = getCountryCoefficient(countryCode);

  // Calculate salary in USD for this country
  const usdAmount = Math.round(usSalary * country.coefficient);

  // Convert to local currency
  const localAmount = Math.round(usdAmount / country.usdRate);

  return {
    localAmount,
    usdAmount,
    currency: country.currency,
  };
}

/**
 * Get list of all supported countries
 */
export function getAllCountries(): Array<{ code: string; name: string }> {
  return Object.entries(COUNTRY_COEFFICIENTS)
    .filter(([code]) => code !== 'UK') // Remove UK alias (use GB)
    .map(([code, data]) => ({ code, name: data.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
