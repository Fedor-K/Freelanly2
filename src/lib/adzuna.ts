/**
 * Adzuna Salary API Client
 *
 * Uses Adzuna's salary endpoints for international salary data:
 * - Histogram: salary distribution for a search
 * - History: historical salary trends
 *
 * API Docs: https://developer.adzuna.com/
 */

const ADZUNA_API_BASE = 'https://api.adzuna.com/v1/api';

// Countries supported by Adzuna API
// https://developer.adzuna.com/overview
export const ADZUNA_COUNTRIES: Record<string, { code: string; name: string; currency: string }> = {
  'AT': { code: 'at', name: 'Austria', currency: 'EUR' },
  'AU': { code: 'au', name: 'Australia', currency: 'AUD' },
  'BE': { code: 'be', name: 'Belgium', currency: 'EUR' },
  'BR': { code: 'br', name: 'Brazil', currency: 'BRL' },
  'CA': { code: 'ca', name: 'Canada', currency: 'CAD' },
  'CH': { code: 'ch', name: 'Switzerland', currency: 'CHF' },
  'DE': { code: 'de', name: 'Germany', currency: 'EUR' },
  'ES': { code: 'es', name: 'Spain', currency: 'EUR' },
  'FR': { code: 'fr', name: 'France', currency: 'EUR' },
  'GB': { code: 'gb', name: 'United Kingdom', currency: 'GBP' },
  'UK': { code: 'gb', name: 'United Kingdom', currency: 'GBP' }, // Alias
  'IN': { code: 'in', name: 'India', currency: 'INR' },
  'IT': { code: 'it', name: 'Italy', currency: 'EUR' },
  'MX': { code: 'mx', name: 'Mexico', currency: 'MXN' },
  'NL': { code: 'nl', name: 'Netherlands', currency: 'EUR' },
  'NZ': { code: 'nz', name: 'New Zealand', currency: 'NZD' },
  'PL': { code: 'pl', name: 'Poland', currency: 'PLN' },
  'RU': { code: 'ru', name: 'Russia', currency: 'RUB' },
  'SG': { code: 'sg', name: 'Singapore', currency: 'SGD' },
  'ZA': { code: 'za', name: 'South Africa', currency: 'ZAR' },
};

// Currency to USD conversion rates (approximate, update periodically)
// These are fallback rates - in production, use a currency API
export const CURRENCY_TO_USD: Record<string, number> = {
  'USD': 1.0,
  'EUR': 1.08,
  'GBP': 1.27,
  'CAD': 0.74,
  'AUD': 0.65,
  'CHF': 1.13,
  'INR': 0.012,
  'BRL': 0.20,
  'MXN': 0.058,
  'PLN': 0.25,
  'NZD': 0.61,
  'SGD': 0.74,
  'ZAR': 0.055,
  'RUB': 0.011,
};

export interface AdzunaHistogramData {
  histogram: Record<string, number>; // salary bucket -> count
  mean?: number;
}

export interface AdzunaSalaryData {
  country: string;
  currency: string;
  minSalary: number;
  maxSalary: number;
  avgSalary: number;
  medianSalary: number;
  percentile25: number;
  percentile75: number;
  sampleSize: number;
  // In USD for comparison
  minSalaryUSD: number;
  maxSalaryUSD: number;
  avgSalaryUSD: number;
}

/**
 * Check if country is supported by Adzuna
 */
export function isAdzunaCountry(countryCode: string): boolean {
  return countryCode.toUpperCase() in ADZUNA_COUNTRIES;
}

/**
 * Get Adzuna country config
 */
export function getAdzunaCountry(countryCode: string) {
  return ADZUNA_COUNTRIES[countryCode.toUpperCase()];
}

/**
 * Convert salary to USD
 */
export function convertToUSD(amount: number, currency: string): number {
  const rate = CURRENCY_TO_USD[currency] || 1;
  return Math.round(amount * rate);
}

/**
 * Fetch salary histogram from Adzuna
 */
export async function fetchAdzunaHistogram(
  jobTitle: string,
  countryCode: string
): Promise<AdzunaHistogramData | null> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    console.warn('[Adzuna] Missing API credentials');
    return null;
  }

  const country = getAdzunaCountry(countryCode);
  if (!country) {
    console.log(`[Adzuna] Country not supported: ${countryCode}`);
    return null;
  }

  try {
    // Build URL with search parameters
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      what: jobTitle,
    });

    const url = `${ADZUNA_API_BASE}/jobs/${country.code}/histogram?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[Adzuna] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    return {
      histogram: data.histogram || {},
      mean: data.mean,
    };

  } catch (error) {
    console.error('[Adzuna] Error fetching histogram:', error);
    return null;
  }
}

/**
 * Calculate salary statistics from histogram
 */
function calculateStatsFromHistogram(histogram: Record<string, number>): {
  min: number;
  max: number;
  avg: number;
  median: number;
  p25: number;
  p75: number;
  total: number;
} | null {
  const entries = Object.entries(histogram)
    .map(([salary, count]) => ({ salary: parseInt(salary), count }))
    .filter(e => !isNaN(e.salary) && e.count > 0)
    .sort((a, b) => a.salary - b.salary);

  if (entries.length === 0) {
    return null;
  }

  const total = entries.reduce((sum, e) => sum + e.count, 0);
  const weightedSum = entries.reduce((sum, e) => sum + e.salary * e.count, 0);

  const min = entries[0].salary;
  const max = entries[entries.length - 1].salary;
  const avg = Math.round(weightedSum / total);

  // Find percentiles
  let cumulative = 0;
  let p25 = min, median = avg, p75 = max;

  for (const entry of entries) {
    cumulative += entry.count;
    const percentile = cumulative / total;

    if (percentile >= 0.25 && p25 === min) {
      p25 = entry.salary;
    }
    if (percentile >= 0.50 && median === avg) {
      median = entry.salary;
    }
    if (percentile >= 0.75 && p75 === max) {
      p75 = entry.salary;
      break;
    }
  }

  return { min, max, avg, median, p25, p75, total };
}

/**
 * Fetch salary data from Adzuna for a job title and country
 */
export async function fetchAdzunaSalary(
  jobTitle: string,
  countryCode: string
): Promise<AdzunaSalaryData | null> {
  const country = getAdzunaCountry(countryCode);
  if (!country) {
    return null;
  }

  const histogramData = await fetchAdzunaHistogram(jobTitle, countryCode);
  if (!histogramData || Object.keys(histogramData.histogram).length === 0) {
    console.log(`[Adzuna] No histogram data for ${jobTitle} in ${countryCode}`);
    return null;
  }

  const stats = calculateStatsFromHistogram(histogramData.histogram);
  if (!stats) {
    return null;
  }

  // Use mean from API if available, otherwise calculated
  const avgSalary = histogramData.mean || stats.avg;

  return {
    country: country.name,
    currency: country.currency,
    minSalary: stats.min,
    maxSalary: stats.max,
    avgSalary: Math.round(avgSalary),
    medianSalary: stats.median,
    percentile25: stats.p25,
    percentile75: stats.p75,
    sampleSize: stats.total,
    // Convert to USD for storage
    minSalaryUSD: convertToUSD(stats.min, country.currency),
    maxSalaryUSD: convertToUSD(stats.max, country.currency),
    avgSalaryUSD: convertToUSD(avgSalary, country.currency),
  };
}

/**
 * Search for jobs to get salary estimates
 * Falls back to search API if histogram doesn't return data
 */
export async function fetchAdzunaJobSearch(
  jobTitle: string,
  countryCode: string,
  page: number = 1
): Promise<{ salaries: number[]; count: number } | null> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    return null;
  }

  const country = getAdzunaCountry(countryCode);
  if (!country) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      what: jobTitle,
      results_per_page: '50',
      page: page.toString(),
      salary_include_unknown: '0', // Only jobs with salary
    });

    const url = `${ADZUNA_API_BASE}/jobs/${country.code}/search/${page}?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const salaries: number[] = [];

    for (const job of data.results || []) {
      if (job.salary_min || job.salary_max) {
        // Use midpoint if both available, otherwise use available value
        const salary = job.salary_min && job.salary_max
          ? (job.salary_min + job.salary_max) / 2
          : job.salary_min || job.salary_max;
        salaries.push(salary);
      }
    }

    return {
      salaries,
      count: data.count || 0,
    };

  } catch (error) {
    console.error('[Adzuna] Error searching jobs:', error);
    return null;
  }
}
