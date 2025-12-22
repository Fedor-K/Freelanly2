import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import type { JobCardData } from '@/types';
import { formatDistanceToNow } from '@/lib/utils';
import { SaveJobButton } from './SaveJobButton';

interface JobCardProps {
  job: JobCardData;
}

export function JobCard({ job }: JobCardProps) {
  const salaryDisplay = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Company Logo */}
          <div className="flex-shrink-0">
            <CompanyLogo
              name={job.company.name}
              logo={job.company.logo}
              website={job.company.website}
              size="md"
            />
          </div>

          {/* Job Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link
                  href={`/company/${job.company.slug}/jobs/${job.slug}`}
                  className="font-semibold hover:underline line-clamp-1"
                >
                  {job.title}
                </Link>
                <Link
                  href={`/company/${job.company.slug}`}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  {job.company.name}
                </Link>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(job.postedAt)}
                </span>
                <SaveJobButton jobId={job.id} />
              </div>
            </div>

            {/* Meta info */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {job.location && (
                <span>{job.location}</span>
              )}
              {salaryDisplay && (
                <>
                  <span>·</span>
                  <span className={job.salaryIsEstimate ? 'italic' : ''}>
                    {salaryDisplay}
                    {job.salaryIsEstimate && ' (est.)'}
                  </span>
                </>
              )}
            </div>

            {/* Tags */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-xs">
                {formatLevel(job.level)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {formatJobType(job.type)}
              </Badge>
              {job.sourceType === 'UNSTRUCTURED' && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  LinkedIn Post
                </Badge>
              )}
              {job.skills.slice(0, 3).map((skill) => (
                <Badge key={skill} variant="outline" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
  period: string | null
): string | null {
  if (!min && !max) return null;
  const curr = currency || 'USD';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
  });

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

  // Add period suffix
  const periodSuffix = formatSalaryPeriod(period);
  return `${salary}${periodSuffix}`;
}

function formatSalaryPeriod(period: string | null): string {
  const labels: Record<string, string> = {
    'HOUR': '/hr',
    'DAY': '/day',
    'WEEK': '/wk',
    'MONTH': '/mo',
    'YEAR': '/yr',
    'ONE_TIME': '',
  };
  // Default to /yr for annual salaries, empty for unknown
  return period ? (labels[period] ?? '') : '';
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

function formatJobType(type: string): string {
  const map: Record<string, string> = {
    FULL_TIME: 'Full-time',
    PART_TIME: 'Part-time',
    CONTRACT: 'Contract',
    FREELANCE: 'Freelance',
    INTERNSHIP: 'Internship',
    TEMPORARY: 'Temporary',
  };
  return map[type] || type;
}
