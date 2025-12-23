/**
 * Audit all jobs - check for issues with companies
 *
 * Checks:
 * - Logo (null, empty, or valid URL)
 * - Company slug vs name mismatch
 * - Website (null, empty, or set)
 * - Description presence
 *
 * Usage: npx tsx scripts/audit-jobs.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Generic company name patterns that indicate bad extraction
const GENERIC_PATTERNS = [
  /^freelance/i,
  /^remote/i,
  /recruitment$/i,
  /hiring$/i,
  /staffing/i,
  /agency$/i,
  /talent/i,
  /^hr\s/i,
  /^human resources/i,
  /job board/i,
  /career/i,
  /employment/i,
];

function isGenericName(name: string): boolean {
  return GENERIC_PATTERNS.some(p => p.test(name));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function checkSlugMatch(name: string, slug: string): boolean {
  const expectedSlug = slugify(name);
  return slug === expectedSlug || slug.startsWith(expectedSlug);
}

interface JobIssue {
  jobId: string;
  jobTitle: string;
  jobSlug: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  logo: string;
  website: string;
  hasDescription: boolean;
  issues: string[];
}

async function main() {
  console.log('Auditing all jobs...\n');

  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          website: true,
        },
      },
    },
    orderBy: { postedAt: 'desc' },
    take: 200, // Last 200 jobs
  });

  console.log(`Found ${jobs.length} jobs\n`);

  const issues: JobIssue[] = [];
  let totalIssues = 0;

  for (const job of jobs) {
    const jobIssues: string[] = [];
    const company = job.company;

    // Check logo
    if (!company.logo) {
      jobIssues.push('NO_LOGO');
    } else if (company.logo === '') {
      jobIssues.push('EMPTY_LOGO');
    }

    // Check website
    if (!company.website) {
      jobIssues.push('NO_WEBSITE');
    } else if (company.website === '') {
      jobIssues.push('EMPTY_WEBSITE');
    }

    // Check if company name is generic
    if (isGenericName(company.name)) {
      jobIssues.push('GENERIC_NAME');
    }

    // Check slug mismatch
    if (!checkSlugMatch(company.name, company.slug)) {
      jobIssues.push('SLUG_MISMATCH');
    }

    // Check description
    if (!job.description || job.description.length < 50) {
      jobIssues.push('SHORT_DESC');
    }

    if (jobIssues.length > 0) {
      totalIssues++;
      issues.push({
        jobId: job.id,
        jobTitle: job.title,
        jobSlug: job.slug,
        companyId: company.id,
        companyName: company.name,
        companySlug: company.slug,
        logo: company.logo || 'NULL',
        website: company.website || 'NULL',
        hasDescription: !!job.description && job.description.length >= 50,
        issues: jobIssues,
      });
    }
  }

  // Print summary
  console.log('='.repeat(120));
  console.log('JOBS WITH ISSUES');
  console.log('='.repeat(120));
  console.log('');

  // Header
  console.log(
    'Company Name'.padEnd(30) +
    'Company Slug'.padEnd(25) +
    'Logo'.padEnd(12) +
    'Website'.padEnd(12) +
    'Issues'
  );
  console.log('-'.repeat(120));

  // Group by company to avoid duplicates
  const companiesWithIssues = new Map<string, JobIssue>();
  for (const issue of issues) {
    if (!companiesWithIssues.has(issue.companyId)) {
      companiesWithIssues.set(issue.companyId, issue);
    }
  }

  for (const issue of companiesWithIssues.values()) {
    const logoStatus = issue.logo === 'NULL' ? 'NULL' : (issue.logo === '' ? 'EMPTY' : 'OK');
    const websiteStatus = issue.website === 'NULL' ? 'NULL' : (issue.website === '' ? 'EMPTY' : 'OK');

    console.log(
      issue.companyName.substring(0, 28).padEnd(30) +
      issue.companySlug.substring(0, 23).padEnd(25) +
      logoStatus.padEnd(12) +
      websiteStatus.padEnd(12) +
      issue.issues.join(', ')
    );
  }

  console.log('');
  console.log('='.repeat(120));
  console.log(`Total jobs checked: ${jobs.length}`);
  console.log(`Jobs with issues: ${totalIssues}`);
  console.log(`Companies with issues: ${companiesWithIssues.size}`);
  console.log('');

  // Stats by issue type
  const issueCounts: Record<string, number> = {};
  for (const issue of issues) {
    for (const i of issue.issues) {
      issueCounts[i] = (issueCounts[i] || 0) + 1;
    }
  }

  console.log('Issue breakdown:');
  for (const [issue, count] of Object.entries(issueCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${issue}: ${count}`);
  }

  // Export full data as JSON for further analysis
  console.log('\n--- Full data saved to: /tmp/job-audit.json ---');
  const fs = await import('fs');
  fs.writeFileSync('/tmp/job-audit.json', JSON.stringify(issues, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
