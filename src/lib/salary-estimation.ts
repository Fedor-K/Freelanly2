/**
 * Salary Estimation Utility
 *
 * Calculates estimated salary for jobs without salary data using formula:
 * BaseSalary[category] × LevelMultiplier[level] × CountryCoefficient[country]
 *
 * Used by all job processors to ensure every job has salary data for Google schema.
 */

import { getBaseSalary } from '@/config/salary-base';
import { getLevelMultiplier, getCountryCoefficient } from '@/config/salary-coefficients';

export interface EstimatedSalary {
  salaryMin: number;
  salaryMax: number;
  salaryCurrency: string;
  salaryPeriod: 'YEAR';
  salaryIsEstimate: true;
}

/**
 * Calculate estimated annual salary for a job
 *
 * @param categorySlug - Job category slug (e.g., 'engineering', 'marketing')
 * @param level - Job level (e.g., 'SENIOR', 'MID', 'JUNIOR')
 * @param country - Country code (e.g., 'US', 'DE', 'IN')
 * @returns Estimated salary object ready for Prisma
 */
export function calculateEstimatedSalary(
  categorySlug: string | null | undefined,
  level: string | null | undefined,
  country: string | null | undefined
): EstimatedSalary {
  const baseSalary = getBaseSalary(categorySlug || 'support');
  const levelMultiplier = getLevelMultiplier(level);
  // Default to US for remote jobs without country (matches salary-insights.ts logic)
  const countryData = getCountryCoefficient(country || 'US');

  // Calculate estimated annual salary in USD
  const estimatedUSD = Math.round(baseSalary * levelMultiplier * countryData.coefficient);

  // Create salary range: -15% to +15%
  const salaryMin = Math.round(estimatedUSD * 0.85);
  const salaryMax = Math.round(estimatedUSD * 1.15);

  return {
    salaryMin,
    salaryMax,
    salaryCurrency: 'USD',
    salaryPeriod: 'YEAR',
    salaryIsEstimate: true,
  };
}

/**
 * Ensure job data has salary information
 *
 * If salaryMin exists, returns empty object (use existing salary).
 * If salaryMin is missing, returns estimated salary object.
 *
 * @param jobData - Partial job data with optional salary fields
 * @param categorySlug - Job category slug
 * @returns Empty object or EstimatedSalary
 */
export function ensureSalaryData(
  jobData: { salaryMin?: number | null },
  categorySlug: string | null | undefined,
  level: string | null | undefined,
  country: string | null | undefined
): Partial<EstimatedSalary> | Record<string, never> {
  // If job already has salary data, don't override
  if (jobData.salaryMin != null) {
    return {};
  }

  // Calculate and return estimated salary
  return calculateEstimatedSalary(categorySlug, level, country);
}
