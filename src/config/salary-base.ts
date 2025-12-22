/**
 * Base Annual Salaries by Category (USD)
 *
 * These are median US annual salaries for Mid-level remote positions.
 * Used as the foundation for salary estimation formula:
 *
 * Annual Salary = BaseSalary[category] × LevelMultiplier[level] × CountryCoefficient[country]
 *
 * Sources: Levels.fyi, Glassdoor, LinkedIn Salary Insights, Payscale (Dec 2024)
 */

export const CATEGORY_BASE_SALARIES: Record<string, number> = {
  // Tech
  engineering: 120000,
  devops: 130000,
  security: 115000,
  data: 95000,
  qa: 121000,

  // Business
  product: 130000,
  marketing: 80000,
  sales: 85000,
  finance: 90000,
  hr: 75000,
  operations: 85000,
  legal: 120000,
  'project-management': 100000,

  // Content & Creative
  design: 85000,
  writing: 70000,
  translation: 60000,
  creative: 70000,

  // Other
  support: 60000,
  education: 65000,
  research: 110000,
  consulting: 110000,
};

// Default fallback if category not found
export const DEFAULT_BASE_SALARY = 75000;

/**
 * Get base salary for a category
 */
export function getBaseSalary(categorySlug: string): number {
  return CATEGORY_BASE_SALARIES[categorySlug.toLowerCase()] ?? DEFAULT_BASE_SALARY;
}
