import { SalaryInsights, SalaryMarketData, UserPlan } from './SalaryInsights';
import { getSalaryInsights } from '@/services/salary-insights';

interface SalaryInsightsAsyncProps {
  jobTitle: string;
  location: string | null;
  country: string | null;
  categoryId: string;
  level: string;
  categorySlug: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryIsEstimate?: boolean;
  userPlan: UserPlan;
}

export async function SalaryInsightsAsync({
  jobTitle,
  location,
  country,
  categoryId,
  level,
  categorySlug,
  salaryMin,
  salaryMax,
  salaryCurrency,
  salaryIsEstimate,
  userPlan,
}: SalaryInsightsAsyncProps) {
  // Fetch salary insights data
  let salaryMarketData: SalaryMarketData | null = null;

  try {
    const salaryData = await getSalaryInsights(
      jobTitle,
      location,
      country,
      categoryId,
      level,
      categorySlug
    );

    if (salaryData) {
      salaryMarketData = {
        avgSalary: salaryData.avgSalary,
        minSalary: salaryData.minSalary,
        maxSalary: salaryData.maxSalary,
        medianSalary: salaryData.medianSalary,
        percentile25: salaryData.percentile25,
        percentile75: salaryData.percentile75,
        sampleSize: salaryData.sampleSize,
        source: salaryData.source,
        sourceLabel: salaryData.sourceLabel,
        isEstimate: salaryData.isEstimate,
        calculationDetails: salaryData.calculationDetails,
      };
    }
  } catch (error) {
    console.error('[SalaryInsightsAsync] Error fetching salary insights:', error);
  }

  return (
    <SalaryInsights
      jobTitle={jobTitle}
      location={location || 'Remote'}
      salaryMin={salaryMin}
      salaryMax={salaryMax}
      currency={salaryCurrency || 'USD'}
      isEstimate={salaryIsEstimate}
      marketData={salaryMarketData}
      userPlan={userPlan}
    />
  );
}
