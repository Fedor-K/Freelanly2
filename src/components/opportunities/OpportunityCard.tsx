'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { OpportunityCardData } from '@/types';
import { formatDistanceToNow } from '@/lib/utils';
import { UnlockContactModal } from './UnlockContactModal';

interface OpportunityCardProps {
  opportunity: OpportunityCardData;
  isPro?: boolean;
}

export function OpportunityCard({ opportunity, isPro = false }: OpportunityCardProps) {
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const salaryDisplay = formatSalary(
    opportunity.salaryMin,
    opportunity.salaryMax,
    opportunity.salaryCurrency,
    opportunity.salaryPeriod
  );

  return (
    <Card className="hover:shadow-md transition-shadow border-orange-200 bg-orange-50/30">
      <CardContent className="p-4">
        {/* Direct Project Banner */}
        <div className="mb-3 -mt-1 flex items-center justify-between">
          <span className="text-sm font-medium text-orange-700 flex items-center gap-1">
            <span className="text-base">🔥</span>
            Direct to Recruiter · No Middlemen
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(opportunity.createdAt)}
          </span>
        </div>

        <div className="flex gap-4">
          {/* Client Avatar */}
          <div className="flex-shrink-0">
            {opportunity.clientAvatar ? (
              <Image
                src={opportunity.clientAvatar}
                alt={opportunity.clientName}
                width={48}
                height={48}
                className={`rounded-full object-cover ${!isPro ? 'blur-[3px]' : ''}`}
              />
            ) : (
              <div className={`w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-semibold text-lg ${!isPro ? 'blur-[3px]' : ''}`}>
                {opportunity.clientName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Opportunity Info */}
          <div className="flex-1 min-w-0">
            <div>
              {/* Client info */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-sm font-medium text-gray-900 ${!isPro ? 'blur-[3px] select-none' : ''}`}>
                  {opportunity.clientName}
                </span>
                {opportunity.clientType === 'company' && (
                  <Badge variant="outline" className="text-xs py-0 h-5">
                    Company
                  </Badge>
                )}
              </div>
              {opportunity.clientHeadline && (
                <p className={`text-xs text-muted-foreground line-clamp-1 mb-2 ${!isPro ? 'blur-[3px] select-none' : ''}`}>
                  {opportunity.clientHeadline}
                </p>
              )}

              {/* Title */}
              <Link
                href={`/freelance/${opportunity.slug}`}
                className="font-semibold hover:underline line-clamp-1 text-gray-900"
              >
                {opportunity.title}
              </Link>
            </div>

            {/* Meta info */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {opportunity.location && <span>{opportunity.location}</span>}
              {salaryDisplay && (
                <>
                  <span>·</span>
                  <span className={opportunity.salaryIsEstimate ? 'italic' : ''}>
                    {salaryDisplay}
                    {opportunity.salaryIsEstimate && ' (est.)'}
                  </span>
                </>
              )}
            </div>

            {/* Tags */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge
                variant="outline"
                className="text-xs bg-red-100/80 text-red-700 border-red-300/60 font-medium backdrop-blur-sm"
              >
                🔥 Urgent
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {formatLevel(opportunity.level)}
              </Badge>
              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300 font-medium">
                💼 Freelance
              </Badge>
              {opportunity.skills.slice(0, 3).map((skill) => (
                <Badge key={skill} variant="outline" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {/* Language badges for translation opportunities */}
              {(opportunity.sourceLanguages?.length > 0 ||
                opportunity.targetLanguages?.length > 0) && (
                <>
                  {getLanguageBadges(
                    opportunity.sourceLanguages,
                    opportunity.targetLanguages
                  ).map((lang) => (
                    <Badge
                      key={lang}
                      variant="outline"
                      className="text-xs bg-green-50 text-green-700 border-green-200"
                    >
                      {lang}
                    </Badge>
                  ))}
                </>
              )}
            </div>

            {/* LinkedIn link / Upgrade CTA */}
            <div className="mt-3 flex items-center gap-2">
              {isPro ? (
                <a
                  href={opportunity.clientLinkedIn}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  View client on LinkedIn →
                </a>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground blur-[3px] select-none">linkedin.com/in/•••</span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowUnlockModal(true);
                    }}
                    className="text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md transition-colors inline-flex items-center gap-1"
                  >
                    🔓 Unlock Contact
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      {/* Unlock Modal */}
      {!isPro && (
        <UnlockContactModal
          open={showUnlockModal}
          onClose={() => setShowUnlockModal(false)}
          hasEmail={false}
        />
      )}
    </Card>
  );
}

// Map invalid/symbol currency codes to valid ISO 4217 codes
const CURRENCY_CODE_MAP: Record<string, string> = {
  RM: 'MYR',
  Rs: 'INR',
  'Rs.': 'INR',
  '₹': 'INR',
  '₱': 'PHP',
  R$: 'BRL',
  '¥': 'JPY',
  '€': 'EUR',
  '£': 'GBP',
  $: 'USD',
  zł: 'PLN',
  kr: 'SEK',
  CHF: 'CHF',
  AED: 'AED',
  SGD: 'SGD',
};

function normalizeCurrencyCode(code: string | null): string {
  if (!code) return 'USD';
  const upper = code.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return CURRENCY_CODE_MAP[code] || CURRENCY_CODE_MAP[upper] || 'USD';
}

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
  period: string | null
): string | null {
  if (!min && !max) return null;
  const curr = normalizeCurrencyCode(currency);

  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
    });
  } catch {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  }

  let salary: string;
  if (min && max) {
    salary = `${formatter.format(min)} - ${formatter.format(max)}`;
  } else if (min) {
    salary = `${formatter.format(min)}+`;
  } else if (max) {
    salary = `Up to ${formatter.format(max)}`;
  } else {
    return null;
  }

  const periodSuffix = formatSalaryPeriod(period);
  return `${salary}${periodSuffix}`;
}

function formatSalaryPeriod(period: string | null): string {
  const labels: Record<string, string> = {
    HOUR: '/hr',
    DAY: '/day',
    WEEK: '/wk',
    MONTH: '/mo',
    YEAR: '/yr',
    ONE_TIME: '',
  };
  return period ? labels[period] ?? '' : '';
}

function formatLevel(level: string): string {
  const map: Record<string, string> = {
    INTERN: 'Intern',
    ENTRY: 'Entry',
    JUNIOR: 'Junior',
    MID: 'Mid',
    SENIOR: 'Senior',
    LEAD: 'Lead',
    MANAGER: 'Manager',
    DIRECTOR: 'Director',
    EXECUTIVE: 'Executive',
  };
  return map[level] || level;
}

function getLanguageBadges(source: string[] = [], target: string[] = []): string[] {
  const allLangs = [...new Set([...source, ...target])];
  if (allLangs.length <= 3) {
    return allLangs;
  }
  const remaining = allLangs.length - 2;
  return [...allLangs.slice(0, 2), `+${remaining}`];
}
