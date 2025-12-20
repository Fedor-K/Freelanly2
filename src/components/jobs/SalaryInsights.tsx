'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface CalculationDetails {
  method: string;
  baselineSource?: string;
  baselineAvg?: number;
  coefficient?: number;
  coefficientName?: string;
}

export interface SalaryMarketData {
  avgSalary: number;
  minSalary: number;
  maxSalary: number;
  medianSalary: number;
  percentile25: number;
  percentile75: number;
  sampleSize: number;
  source: string;
  sourceLabel: string;
  isEstimate: boolean;
  calculationDetails?: CalculationDetails;
}

interface SalaryInsightsProps {
  jobTitle: string;
  location: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  isEstimate?: boolean;
  marketData?: SalaryMarketData | null;
}

export function SalaryInsights({
  jobTitle,
  location,
  salaryMin,
  salaryMax,
  currency = 'USD',
  isEstimate,
  marketData,
}: SalaryInsightsProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // If no market data provided, don't render the component
  if (!marketData) {
    return null;
  }

  const data = marketData;

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 0,
  });

  const formatK = (val: number) => `$${(val / 1000).toFixed(0)}K`;

  // Calculate where this job's salary falls in the market range
  const jobMidpoint = salaryMin && salaryMax ? (salaryMin + salaryMax) / 2 : salaryMin || salaryMax;
  const marketRange = data.maxSalary - data.minSalary;
  const jobPercentile = jobMidpoint && marketRange > 0
    ? Math.min(100, Math.max(0, ((jobMidpoint - data.minSalary) / marketRange) * 100))
    : null;

  let salaryComparison = 'within market range';
  if (jobMidpoint) {
    if (jobMidpoint > data.percentile75) {
      salaryComparison = 'above market average';
    } else if (jobMidpoint < data.percentile25) {
      salaryComparison = 'below market average';
    }
  }

  // Source badge color
  const getSourceBadgeClass = () => {
    switch (data.source) {
      case 'BLS':
        return 'bg-blue-100 text-blue-700';
      case 'ADZUNA':
        return 'bg-green-100 text-green-700';
      case 'CALCULATED':
        return 'bg-purple-100 text-purple-700';
      case 'ESTIMATED':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          📊 Salary Insights
        </CardTitle>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {data.sampleSize > 0
              ? `Based on ${data.sampleSize.toLocaleString()} similar ${jobTitle.toLowerCase()} roles`
              : `Market estimate for ${jobTitle.toLowerCase()} roles`
            }
          </p>
          <div className="relative inline-block">
            <span
              className={`text-xs px-2 py-0.5 rounded w-fit cursor-help ${getSourceBadgeClass()}`}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              {data.sourceLabel}
              {data.calculationDetails && <span className="ml-1">ⓘ</span>}
            </span>
            {showTooltip && data.calculationDetails && (
              <div className="absolute z-50 left-0 top-full mt-2 w-72 p-3 bg-popover border rounded-lg shadow-lg text-sm">
                <p className="font-medium mb-2">How this was calculated:</p>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>
                    <span className="font-medium">Method:</span> {data.calculationDetails.method}
                  </li>
                  {data.calculationDetails.baselineSource && (
                    <li>
                      <span className="font-medium">Baseline:</span> {data.calculationDetails.baselineSource}
                    </li>
                  )}
                  {data.calculationDetails.baselineAvg && (
                    <li>
                      <span className="font-medium">US Average:</span> ${data.calculationDetails.baselineAvg.toLocaleString()}/year
                    </li>
                  )}
                  {data.calculationDetails.coefficient && (
                    <li>
                      <span className="font-medium">Coefficient:</span> ×{data.calculationDetails.coefficient} ({data.calculationDetails.coefficientName})
                    </li>
                  )}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground border-t pt-2">
                  ${data.calculationDetails.baselineAvg?.toLocaleString()} × {data.calculationDetails.coefficient} = ${data.avgSalary.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Market Range Visualization */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Market Range</span>
            <span className="font-medium">
              {formatK(data.minSalary)} - {formatK(data.maxSalary)}
            </span>
          </div>
          <div className="relative h-8 bg-muted rounded-full overflow-hidden">
            {/* Full range */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-200 via-green-200 to-blue-200" />

            {/* 25th-75th percentile highlight */}
            {marketRange > 0 && (
              <div
                className="absolute top-0 bottom-0 bg-green-400/60"
                style={{
                  left: `${((data.percentile25 - data.minSalary) / marketRange) * 100}%`,
                  width: `${((data.percentile75 - data.percentile25) / marketRange) * 100}%`,
                }}
              />
            )}

            {/* This job's position */}
            {jobPercentile !== null && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-primary"
                style={{ left: `${jobPercentile}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatK(data.minSalary)}</span>
            <span>Avg: {formatK(data.avgSalary)}</span>
            <span>{formatK(data.maxSalary)}</span>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{formatK(data.avgSalary)}</p>
            <p className="text-xs text-muted-foreground">Average Salary</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">
              {data.sampleSize > 0 ? data.sampleSize.toLocaleString() : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Similar Jobs</p>
          </div>
        </div>

        {/* Percentile Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">25th Percentile</span>
            <span>{formatter.format(data.percentile25)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Median</span>
            <span>{formatter.format(data.medianSalary)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">75th Percentile</span>
            <span>{formatter.format(data.percentile75)}</span>
          </div>
        </div>

        {/* This Job's Position */}
        {(salaryMin || salaryMax) && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">This Job:</span>
              <span className={`text-sm px-2 py-0.5 rounded ${
                salaryComparison === 'above market average'
                  ? 'bg-green-100 text-green-700'
                  : salaryComparison === 'below market average'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {salaryComparison}
              </span>
            </div>
            {isEstimate && (
              <p className="text-xs text-muted-foreground mt-1">
                Note: Salary is estimated and may vary
              </p>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground border-t pt-4">
          {data.isEstimate
            ? `Salary data is estimated based on market trends for ${location}. Actual compensation may vary based on experience, skills, and company.`
            : `Salary data is aggregated from similar roles in ${location}. Actual compensation may vary based on experience, skills, and company.`
          }
        </p>
      </CardContent>
    </Card>
  );
}
