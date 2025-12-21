/**
 * Salary Insights Service
 *
 * Provides salary market data for jobs using:
 * 1. BLS API for US jobs
 * 2. Adzuna API for international jobs
 * 3. Coefficient-based estimation for unsupported countries
 * 4. Database fallback from similar jobs
 *
 * All data is cached in salary_benchmarks table.
 */

import { prisma } from '@/lib/db';
import { SalarySource } from '@prisma/client';
import { fetchBLSSalary, findOccupationCode } from '@/lib/bls';
import { fetchAdzunaSalary, isAdzunaCountry, convertToUSD } from '@/lib/adzuna';
import { getCountryCoefficient, estimateSalaryForCountry } from '@/config/salary-coefficients';

// Cache duration in days
const CACHE_DURATION_DAYS = 30;

export interface SalaryInsightsData {
  minSalary: number;
  maxSalary: number;
  avgSalary: number;
  medianSalary: number;
  percentile25: number;
  percentile75: number;
  sampleSize: number;
  source: SalarySource;
  sourceLabel: string;
  country: string;
  currency: string;
  jobTitle: string;
  isEstimate: boolean;
  // Calculation details for tooltip
  calculationDetails?: {
    method: string;
    baselineSource?: string;
    baselineAvg?: number;
    coefficient?: number;
    coefficientName?: string;
  };
}

/**
 * Normalize job title for caching
 */
function normalizeJobTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    // Remove level prefixes
    .replace(/^(senior|junior|lead|principal|staff|entry.level|mid.level)\s+/i, '')
    // Remove company suffixes
    .replace(/\s+at\s+.+$/i, '')
    // Remove special characters
    .replace(/[^\w\s]/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract country code from location string
 */
function extractCountryCode(location: string | null | undefined, country: string | null | undefined): string {
  // If country is already provided, use it
  if (country && country.length === 2) {
    return country.toUpperCase();
  }

  if (!location) {
    return 'US'; // Default to US for remote jobs
  }

  const locationLower = location.toLowerCase();

  // Check for "Remote" - default to US
  if (locationLower === 'remote' || locationLower.includes('worldwide') || locationLower.includes('anywhere')) {
    return 'US';
  }

  // Common country patterns (including major cities)
  const countryPatterns: Record<string, string[]> = {
    'US': ['usa', 'united states', 'u.s.', 'america', 'new york', 'san francisco', 'los angeles', 'chicago', 'seattle', 'austin', 'boston', 'denver', 'miami', 'atlanta'],
    'GB': ['uk', 'united kingdom', 'england', 'britain', 'london', 'manchester', 'birmingham', 'edinburgh', 'glasgow', 'bristol', 'cambridge', 'oxford'],
    'DE': ['germany', 'deutschland', 'berlin', 'munich', 'frankfurt', 'hamburg', 'köln', 'cologne'],
    'FR': ['france', 'paris', 'lyon', 'marseille'],
    'CA': ['canada', 'toronto', 'vancouver', 'montreal'],
    'AU': ['australia', 'sydney', 'melbourne', 'brisbane'],
    'NL': ['netherlands', 'holland', 'amsterdam', 'rotterdam'],
    'ES': ['spain', 'españa', 'madrid', 'barcelona'],
    'IT': ['italy', 'italia', 'rome', 'milan', 'roma', 'milano'],
    'PL': ['poland', 'polska', 'warsaw', 'krakow', 'wroclaw'],
    'IN': ['india', 'bangalore', 'mumbai', 'delhi', 'hyderabad', 'chennai', 'bengaluru'],
    'BR': ['brazil', 'brasil', 'são paulo', 'rio de janeiro'],
    'SG': ['singapore'],
    'IL': ['israel', 'tel aviv', 'jerusalem'],
    'IE': ['ireland', 'dublin'],
    'SE': ['sweden', 'stockholm'],
    'CH': ['switzerland', 'zurich', 'geneva', 'zürich'],
    'JP': ['japan', 'tokyo', 'osaka'],
    'KR': ['korea', 'seoul'],
    'MX': ['mexico', 'mexico city'],
    'AR': ['argentina', 'buenos aires'],
  };

  for (const [code, patterns] of Object.entries(countryPatterns)) {
    for (const pattern of patterns) {
      if (locationLower.includes(pattern)) {
        return code;
      }
    }
  }

  // Check for 2-letter country codes at end of location
  const parts = location.split(/[,\s]+/);
  const lastPart = parts[parts.length - 1]?.toUpperCase();
  if (lastPart && lastPart.length === 2 && /^[A-Z]{2}$/.test(lastPart)) {
    return lastPart;
  }

  // Default to US
  return 'US';
}

/**
 * Check cache for existing salary data
 */
async function getCachedSalary(
  jobTitle: string,
  country: string,
  region: string = ''
): Promise<SalaryInsightsData | null> {
  try {
    const cached = await prisma.salaryBenchmark.findFirst({
      where: {
        jobTitle,
        country,
        region: region || '',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (cached) {
      // For ESTIMATED source, include country name in label
      let sourceLabel = getSourceLabel(cached.source);
      if (cached.source === 'ESTIMATED') {
        const coefficient = getCountryCoefficient(country);
        sourceLabel = `Estimated for ${coefficient.name}`;
      }

      return {
        minSalary: cached.minSalary,
        maxSalary: cached.maxSalary,
        avgSalary: cached.avgSalary,
        medianSalary: cached.medianSalary,
        percentile25: cached.percentile25,
        percentile75: cached.percentile75,
        sampleSize: cached.sampleSize,
        source: cached.source,
        sourceLabel,
        country,
        currency: 'USD',
        jobTitle: cached.jobTitle,
        isEstimate: cached.source === 'ESTIMATED' || cached.source === 'CALCULATED',
      };
    }

    return null;
  } catch (error) {
    // Handle missing table gracefully
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('SalaryBenchmark')) {
      console.log('[SalaryInsights] SalaryBenchmark table not found - skipping cache. Run: npx prisma db push');
    } else {
      console.error('[SalaryInsights] Cache read error:', error);
    }
    return null;
  }
}

/**
 * Save salary data to cache
 */
async function cacheSalary(
  jobTitle: string,
  country: string,
  data: Omit<SalaryInsightsData, 'sourceLabel' | 'jobTitle' | 'isEstimate'>,
  sourceCode?: string,
  rawResponse?: unknown
): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_DURATION_DAYS);

    // Upsert using the unique constraint
    await prisma.salaryBenchmark.upsert({
      where: {
        jobTitle_country_region: {
          jobTitle,
          country,
          region: '',
        },
      },
      update: {
        minSalary: data.minSalary,
        maxSalary: data.maxSalary,
        avgSalary: data.avgSalary,
        medianSalary: data.medianSalary,
        percentile25: data.percentile25,
        percentile75: data.percentile75,
        sampleSize: data.sampleSize,
        source: data.source,
        sourceCode,
        rawResponse: rawResponse ? JSON.parse(JSON.stringify(rawResponse)) : null,
        expiresAt,
      },
      create: {
        jobTitle,
        country,
        region: '',
        minSalary: data.minSalary,
        maxSalary: data.maxSalary,
        avgSalary: data.avgSalary,
        medianSalary: data.medianSalary,
        percentile25: data.percentile25,
        percentile75: data.percentile75,
        sampleSize: data.sampleSize,
        source: data.source,
        sourceCode,
        rawResponse: rawResponse ? JSON.parse(JSON.stringify(rawResponse)) : null,
        expiresAt,
      },
    });
  } catch (error) {
    // Handle missing table gracefully - caching will be skipped
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('SalaryBenchmark')) {
      // Silently skip - already logged in getCachedSalary
    } else {
      console.error('[SalaryInsights] Cache write error:', error);
    }
  }
}

/**
 * Get source label for display
 */
function getSourceLabel(source: SalarySource): string {
  switch (source) {
    case 'BLS':
      return 'U.S. Bureau of Labor Statistics';
    case 'ADZUNA':
      return 'Adzuna Job Market Data';
    case 'CALCULATED':
      return 'Based on similar jobs on Freelanly';
    case 'ESTIMATED':
      return 'Market estimate';
    default:
      return 'Market data';
  }
}

/**
 * Fetch salary data from BLS (US only)
 */
async function fetchFromBLS(
  jobTitle: string,
  normalizedTitle: string
): Promise<SalaryInsightsData | null> {
  const blsData = await fetchBLSSalary(jobTitle);

  if (!blsData) {
    return null;
  }

  const data: SalaryInsightsData = {
    minSalary: blsData.percentile10 || Math.round(blsData.annualMeanWage * 0.5),
    maxSalary: blsData.percentile90 || Math.round(blsData.annualMeanWage * 1.8),
    avgSalary: blsData.annualMeanWage,
    medianSalary: blsData.percentile50 || blsData.annualMeanWage,
    percentile25: blsData.percentile25 || Math.round(blsData.annualMeanWage * 0.75),
    percentile75: blsData.percentile75 || Math.round(blsData.annualMeanWage * 1.25),
    sampleSize: blsData.employment || 1000,
    source: 'BLS',
    sourceLabel: getSourceLabel('BLS'),
    country: 'US',
    currency: 'USD',
    jobTitle: normalizedTitle,
    isEstimate: false,
  };

  // Cache the result
  await cacheSalary(normalizedTitle, 'US', data, blsData.occupationCode, blsData);

  return data;
}

/**
 * Fetch salary data from Adzuna (international)
 */
async function fetchFromAdzuna(
  jobTitle: string,
  normalizedTitle: string,
  country: string
): Promise<SalaryInsightsData | null> {
  const adzunaData = await fetchAdzunaSalary(jobTitle, country);

  if (!adzunaData) {
    return null;
  }

  // Validate that we have meaningful salary data (not all zeros)
  // Minimum $1000 annual salary to be considered valid
  const MIN_VALID_SALARY = 1000;
  if (adzunaData.avgSalaryUSD < MIN_VALID_SALARY || adzunaData.sampleSize < 1) {
    console.log(`[Adzuna] Invalid/insufficient data for "${jobTitle}": avg=${adzunaData.avgSalaryUSD}, samples=${adzunaData.sampleSize}`);
    return null;
  }

  const data: SalaryInsightsData = {
    minSalary: adzunaData.minSalaryUSD,
    maxSalary: adzunaData.maxSalaryUSD,
    avgSalary: adzunaData.avgSalaryUSD,
    medianSalary: convertToUSD(adzunaData.medianSalary, adzunaData.currency),
    percentile25: convertToUSD(adzunaData.percentile25, adzunaData.currency),
    percentile75: convertToUSD(adzunaData.percentile75, adzunaData.currency),
    sampleSize: adzunaData.sampleSize,
    source: 'ADZUNA',
    sourceLabel: getSourceLabel('ADZUNA'),
    country,
    currency: 'USD',
    jobTitle: normalizedTitle,
    isEstimate: false,
  };

  // Cache the result
  await cacheSalary(normalizedTitle, country, data, undefined, adzunaData);

  return data;
}

/**
 * Calculate salary from similar jobs in our database
 */
async function calculateFromDatabase(
  jobTitle: string,
  normalizedTitle: string,
  categoryId?: string
): Promise<SalaryInsightsData | null> {
  try {
    // Find jobs with similar titles and salary data
    const keywords = normalizedTitle.split(' ').filter(w => w.length > 2);

    const conditions = keywords.map(keyword => ({
      title: { contains: keyword, mode: 'insensitive' as const },
    }));

    const jobs = await prisma.job.findMany({
      where: {
        AND: [
          { salaryMin: { not: null } },
          { salaryMax: { not: null } },
          { salaryCurrency: 'USD' },
          { salaryPeriod: 'YEAR' },
          {
            OR: [
              ...conditions,
              ...(categoryId ? [{ categoryId }] : []),
            ],
          },
        ],
      },
      select: {
        salaryMin: true,
        salaryMax: true,
      },
      take: 100,
    });

    if (jobs.length < 3) {
      return null;
    }

    // Calculate statistics
    // Filter out unrealistic annual salaries (< $10K likely means hourly rate stored incorrectly)
    const MIN_ANNUAL_SALARY = 10000;
    const salaries = jobs
      .map(j => ((j.salaryMin || 0) + (j.salaryMax || 0)) / 2)
      .filter(s => s >= MIN_ANNUAL_SALARY)
      .sort((a, b) => a - b);

    if (salaries.length < 3) {
      return null;
    }

    const sum = salaries.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / salaries.length);
    const median = salaries[Math.floor(salaries.length / 2)];
    const p25 = salaries[Math.floor(salaries.length * 0.25)];
    const p75 = salaries[Math.floor(salaries.length * 0.75)];

    const data: SalaryInsightsData = {
      minSalary: salaries[0],
      maxSalary: salaries[salaries.length - 1],
      avgSalary: avg,
      medianSalary: Math.round(median),
      percentile25: Math.round(p25),
      percentile75: Math.round(p75),
      sampleSize: salaries.length,
      source: 'CALCULATED',
      sourceLabel: getSourceLabel('CALCULATED'),
      country: 'US',
      currency: 'USD',
      jobTitle: normalizedTitle,
      isEstimate: true,
    };

    // Cache the result
    await cacheSalary(normalizedTitle, 'US', data);

    return data;
  } catch (error) {
    console.error('[SalaryInsights] Database calculation error:', error);
    return null;
  }
}

/**
 * Estimate salary using country coefficients
 */
async function estimateFromCoefficients(
  jobTitle: string,
  normalizedTitle: string,
  country: string
): Promise<SalaryInsightsData | null> {
  // First, try to get US baseline (from cache, BLS, or calculation)
  let usBaseline = await getCachedSalary(normalizedTitle, 'US');

  if (!usBaseline) {
    // Try BLS
    usBaseline = await fetchFromBLS(jobTitle, normalizedTitle);
  }

  if (!usBaseline) {
    // Try database calculation
    usBaseline = await calculateFromDatabase(jobTitle, normalizedTitle);
  }

  if (!usBaseline) {
    // Use a generic fallback based on job type
    const occupation = findOccupationCode(jobTitle);
    const genericSalary = occupation ? 100000 : 70000; // Tech vs non-tech default

    usBaseline = {
      minSalary: Math.round(genericSalary * 0.6),
      maxSalary: Math.round(genericSalary * 1.5),
      avgSalary: genericSalary,
      medianSalary: genericSalary,
      percentile25: Math.round(genericSalary * 0.75),
      percentile75: Math.round(genericSalary * 1.25),
      sampleSize: 0,
      source: 'ESTIMATED',
      sourceLabel: getSourceLabel('ESTIMATED'),
      country: 'US',
      currency: 'USD',
      jobTitle: normalizedTitle,
      isEstimate: true,
    };
  }

  // Apply country coefficient
  const coefficient = getCountryCoefficient(country);

  // Determine baseline source description
  const baselineSourceDesc = usBaseline.source === 'BLS'
    ? 'BLS (US Bureau of Labor Statistics)'
    : usBaseline.source === 'CALCULATED'
    ? 'Similar jobs in database'
    : 'Industry average estimate';

  const data: SalaryInsightsData = {
    minSalary: Math.round(usBaseline.minSalary * coefficient.coefficient),
    maxSalary: Math.round(usBaseline.maxSalary * coefficient.coefficient),
    avgSalary: Math.round(usBaseline.avgSalary * coefficient.coefficient),
    medianSalary: Math.round(usBaseline.medianSalary * coefficient.coefficient),
    percentile25: Math.round(usBaseline.percentile25 * coefficient.coefficient),
    percentile75: Math.round(usBaseline.percentile75 * coefficient.coefficient),
    sampleSize: usBaseline.sampleSize,
    source: 'ESTIMATED',
    sourceLabel: `Estimated for ${coefficient.name}`,
    country,
    currency: 'USD',
    jobTitle: normalizedTitle,
    isEstimate: true,
    calculationDetails: {
      method: 'Country coefficient adjustment',
      baselineSource: baselineSourceDesc,
      baselineAvg: usBaseline.avgSalary,
      coefficient: coefficient.coefficient,
      coefficientName: coefficient.name,
    },
  };

  // Cache the result
  await cacheSalary(normalizedTitle, country, data);

  return data;
}

/**
 * Main function: Get salary insights for a job
 */
export async function getSalaryInsights(
  jobTitle: string,
  location?: string | null,
  country?: string | null,
  categoryId?: string
): Promise<SalaryInsightsData | null> {
  const normalizedTitle = normalizeJobTitle(jobTitle);
  const countryCode = extractCountryCode(location, country);

  console.log(`[SalaryInsights] Getting data for "${normalizedTitle}" in ${countryCode}`);

  // 1. Check cache first
  const cached = await getCachedSalary(normalizedTitle, countryCode);
  if (cached) {
    console.log(`[SalaryInsights] Cache hit for "${normalizedTitle}" in ${countryCode}`);
    return cached;
  }

  // 2. US jobs → BLS
  if (countryCode === 'US') {
    const blsData = await fetchFromBLS(jobTitle, normalizedTitle);
    if (blsData) {
      return blsData;
    }

    // Fallback to database calculation for US
    const dbData = await calculateFromDatabase(jobTitle, normalizedTitle, categoryId);
    if (dbData) {
      return dbData;
    }
  }

  // 3. Adzuna-supported countries
  if (isAdzunaCountry(countryCode)) {
    const adzunaData = await fetchFromAdzuna(jobTitle, normalizedTitle, countryCode);
    if (adzunaData) {
      return adzunaData;
    }
  }

  // 4. Fallback: coefficient-based estimation
  const estimated = await estimateFromCoefficients(jobTitle, normalizedTitle, countryCode);
  return estimated;
}

/**
 * Batch get salary insights for multiple jobs (useful for list pages)
 */
export async function batchGetSalaryInsights(
  jobs: Array<{ id: string; title: string; location?: string | null; country?: string | null }>
): Promise<Map<string, SalaryInsightsData | null>> {
  const results = new Map<string, SalaryInsightsData | null>();

  // Process in parallel with concurrency limit
  const CONCURRENCY = 5;
  const chunks = [];

  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    chunks.push(jobs.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (job) => {
      const data = await getSalaryInsights(job.title, job.location, job.country);
      results.set(job.id, data);
    });

    await Promise.all(promises);
  }

  return results;
}
