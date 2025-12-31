/**
 * Salary range configuration for programmatic SEO pages
 * URL pattern: /jobs/[category]/salary/[range]
 */

export interface SalaryRange {
  slug: string;        // URL slug: "50k-100k"
  label: string;       // Display label: "$50K - $100K"
  min: number;         // Min salary (annual USD)
  max: number | null;  // Max salary (null = no upper limit)
  description: string; // SEO description
}

export const salaryRanges: SalaryRange[] = [
  {
    slug: '0-50k',
    label: 'Under $50K',
    min: 0,
    max: 50000,
    description: 'Entry-level and junior positions with salaries up to $50,000 per year',
  },
  {
    slug: '50k-100k',
    label: '$50K - $100K',
    min: 50000,
    max: 100000,
    description: 'Mid-level positions with salaries between $50,000 and $100,000 per year',
  },
  {
    slug: '100k-150k',
    label: '$100K - $150K',
    min: 100000,
    max: 150000,
    description: 'Senior positions with salaries between $100,000 and $150,000 per year',
  },
  {
    slug: '150k-plus',
    label: '$150K+',
    min: 150000,
    max: null,
    description: 'Executive and staff-level positions with salaries above $150,000 per year',
  },
];

export function getSalaryRangeBySlug(slug: string): SalaryRange | undefined {
  return salaryRanges.find((range) => range.slug === slug);
}

export function getSalaryRangeForAmount(amount: number): SalaryRange | undefined {
  return salaryRanges.find((range) => {
    if (range.max === null) {
      return amount >= range.min;
    }
    return amount >= range.min && amount < range.max;
  });
}
