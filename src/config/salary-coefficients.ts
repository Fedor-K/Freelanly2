/**
 * Country Salary Coefficients
 *
 * Used to estimate salaries in countries not covered by BLS or Adzuna.
 * Coefficients are relative to US salaries (US = 1.0).
 *
 * Based on:
 * - Cost of living indices
 * - Tech salary surveys (Levels.fyi, Glassdoor)
 * - Remote work salary data
 *
 * These should be updated periodically based on market data.
 */

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
  'CA': { name: 'Canada', coefficient: 0.80, currency: 'CAD', currencySymbol: 'C$', usdRate: 0.74 },
  'MX': { name: 'Mexico', coefficient: 0.35, currency: 'MXN', currencySymbol: '$', usdRate: 0.058 },

  // Western Europe (high)
  'CH': { name: 'Switzerland', coefficient: 1.15, currency: 'CHF', currencySymbol: 'CHF', usdRate: 1.13 },
  'GB': { name: 'United Kingdom', coefficient: 0.85, currency: 'GBP', currencySymbol: '£', usdRate: 1.27 },
  'UK': { name: 'United Kingdom', coefficient: 0.85, currency: 'GBP', currencySymbol: '£', usdRate: 1.27 },
  'DE': { name: 'Germany', coefficient: 0.75, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'NL': { name: 'Netherlands', coefficient: 0.75, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'IE': { name: 'Ireland', coefficient: 0.80, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'BE': { name: 'Belgium', coefficient: 0.70, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'LU': { name: 'Luxembourg', coefficient: 0.85, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'AT': { name: 'Austria', coefficient: 0.70, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'FR': { name: 'France', coefficient: 0.65, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },

  // Northern Europe
  'SE': { name: 'Sweden', coefficient: 0.70, currency: 'SEK', currencySymbol: 'kr', usdRate: 0.095 },
  'NO': { name: 'Norway', coefficient: 0.80, currency: 'NOK', currencySymbol: 'kr', usdRate: 0.093 },
  'DK': { name: 'Denmark', coefficient: 0.75, currency: 'DKK', currencySymbol: 'kr', usdRate: 0.145 },
  'FI': { name: 'Finland', coefficient: 0.65, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },

  // Southern Europe
  'ES': { name: 'Spain', coefficient: 0.50, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'IT': { name: 'Italy', coefficient: 0.55, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'PT': { name: 'Portugal', coefficient: 0.45, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'GR': { name: 'Greece', coefficient: 0.40, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },

  // Eastern Europe
  'PL': { name: 'Poland', coefficient: 0.45, currency: 'PLN', currencySymbol: 'zł', usdRate: 0.25 },
  'CZ': { name: 'Czech Republic', coefficient: 0.45, currency: 'CZK', currencySymbol: 'Kč', usdRate: 0.044 },
  'RO': { name: 'Romania', coefficient: 0.35, currency: 'RON', currencySymbol: 'lei', usdRate: 0.22 },
  'HU': { name: 'Hungary', coefficient: 0.35, currency: 'HUF', currencySymbol: 'Ft', usdRate: 0.0028 },
  'UA': { name: 'Ukraine', coefficient: 0.30, currency: 'UAH', currencySymbol: '₴', usdRate: 0.024 },
  'RU': { name: 'Russia', coefficient: 0.35, currency: 'RUB', currencySymbol: '₽', usdRate: 0.011 },
  'BY': { name: 'Belarus', coefficient: 0.30, currency: 'BYN', currencySymbol: 'Br', usdRate: 0.31 },

  // Baltic
  'EE': { name: 'Estonia', coefficient: 0.50, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'LV': { name: 'Latvia', coefficient: 0.40, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },
  'LT': { name: 'Lithuania', coefficient: 0.40, currency: 'EUR', currencySymbol: '€', usdRate: 1.08 },

  // Asia-Pacific (high)
  'AU': { name: 'Australia', coefficient: 0.75, currency: 'AUD', currencySymbol: 'A$', usdRate: 0.65 },
  'NZ': { name: 'New Zealand', coefficient: 0.65, currency: 'NZD', currencySymbol: 'NZ$', usdRate: 0.61 },
  'SG': { name: 'Singapore', coefficient: 0.80, currency: 'SGD', currencySymbol: 'S$', usdRate: 0.74 },
  'HK': { name: 'Hong Kong', coefficient: 0.70, currency: 'HKD', currencySymbol: 'HK$', usdRate: 0.13 },
  'JP': { name: 'Japan', coefficient: 0.60, currency: 'JPY', currencySymbol: '¥', usdRate: 0.0067 },
  'KR': { name: 'South Korea', coefficient: 0.55, currency: 'KRW', currencySymbol: '₩', usdRate: 0.00075 },
  'TW': { name: 'Taiwan', coefficient: 0.50, currency: 'TWD', currencySymbol: 'NT$', usdRate: 0.031 },

  // Asia (developing)
  'IN': { name: 'India', coefficient: 0.25, currency: 'INR', currencySymbol: '₹', usdRate: 0.012 },
  'PH': { name: 'Philippines', coefficient: 0.25, currency: 'PHP', currencySymbol: '₱', usdRate: 0.018 },
  'ID': { name: 'Indonesia', coefficient: 0.20, currency: 'IDR', currencySymbol: 'Rp', usdRate: 0.000063 },
  'VN': { name: 'Vietnam', coefficient: 0.25, currency: 'VND', currencySymbol: '₫', usdRate: 0.000040 },
  'TH': { name: 'Thailand', coefficient: 0.30, currency: 'THB', currencySymbol: '฿', usdRate: 0.029 },
  'MY': { name: 'Malaysia', coefficient: 0.35, currency: 'MYR', currencySymbol: 'RM', usdRate: 0.22 },
  'CN': { name: 'China', coefficient: 0.45, currency: 'CNY', currencySymbol: '¥', usdRate: 0.14 },

  // Middle East
  'IL': { name: 'Israel', coefficient: 0.85, currency: 'ILS', currencySymbol: '₪', usdRate: 0.27 },
  'AE': { name: 'United Arab Emirates', coefficient: 0.70, currency: 'AED', currencySymbol: 'د.إ', usdRate: 0.27 },
  'SA': { name: 'Saudi Arabia', coefficient: 0.60, currency: 'SAR', currencySymbol: '﷼', usdRate: 0.27 },

  // South America
  'BR': { name: 'Brazil', coefficient: 0.35, currency: 'BRL', currencySymbol: 'R$', usdRate: 0.20 },
  'AR': { name: 'Argentina', coefficient: 0.30, currency: 'ARS', currencySymbol: '$', usdRate: 0.0012 },
  'CL': { name: 'Chile', coefficient: 0.40, currency: 'CLP', currencySymbol: '$', usdRate: 0.0011 },
  'CO': { name: 'Colombia', coefficient: 0.30, currency: 'COP', currencySymbol: '$', usdRate: 0.00025 },
  'PE': { name: 'Peru', coefficient: 0.30, currency: 'PEN', currencySymbol: 'S/', usdRate: 0.27 },

  // Africa
  'ZA': { name: 'South Africa', coefficient: 0.35, currency: 'ZAR', currencySymbol: 'R', usdRate: 0.055 },
  'NG': { name: 'Nigeria', coefficient: 0.20, currency: 'NGN', currencySymbol: '₦', usdRate: 0.00065 },
  'KE': { name: 'Kenya', coefficient: 0.20, currency: 'KES', currencySymbol: 'KSh', usdRate: 0.0077 },
  'EG': { name: 'Egypt', coefficient: 0.20, currency: 'EGP', currencySymbol: 'E£', usdRate: 0.032 },
};

// Default coefficient for unknown countries
export const DEFAULT_COEFFICIENT: CountryCoefficient = {
  name: 'Global Average',
  coefficient: 0.50,  // Default to 50% of US salary
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
