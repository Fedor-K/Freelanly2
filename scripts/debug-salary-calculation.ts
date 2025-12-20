/**
 * Debug script to see which jobs are used in salary calculation
 * Usage: npx tsx scripts/debug-salary-calculation.ts "Epic Professional Billing Analyst/Trainer"
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugSalaryCalculation(jobTitle: string) {
  console.log(`\n🔍 Debugging salary calculation for: "${jobTitle}"\n`);

  // Normalize title (same as in salary-insights.ts)
  const normalizedTitle = jobTitle
    .toLowerCase()
    .trim()
    .replace(/^(senior|junior|lead|principal|staff|entry.level|mid.level)\s+/i, '')
    .replace(/\s+at\s+.+$/i, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  console.log(`📝 Normalized title: "${normalizedTitle}"`);

  const keywords = normalizedTitle.split(' ').filter(w => w.length > 2);
  console.log(`🔑 Keywords: ${keywords.join(', ')}\n`);

  // Build conditions
  const conditions = keywords.map(keyword => ({
    title: { contains: keyword, mode: 'insensitive' as const },
  }));

  // Find matching jobs
  const jobs = await prisma.job.findMany({
    where: {
      AND: [
        { salaryMin: { not: null } },
        { salaryMax: { not: null } },
        { salaryCurrency: 'USD' },
        { salaryPeriod: 'YEAR' },
        {
          OR: conditions,
        },
      ],
    },
    select: {
      id: true,
      title: true,
      salaryMin: true,
      salaryMax: true,
      salaryPeriod: true,
      salaryCurrency: true,
      company: { select: { name: true } },
      createdAt: true,
    },
    take: 100,
  });

  console.log(`📊 Found ${jobs.length} matching jobs:\n`);

  if (jobs.length === 0) {
    console.log('No jobs found matching the criteria.');
    return;
  }

  // Display each job
  jobs.forEach((job, i) => {
    const avg = ((job.salaryMin || 0) + (job.salaryMax || 0)) / 2;
    console.log(`${i + 1}. ${job.title}`);
    console.log(`   Company: ${job.company.name}`);
    console.log(`   Salary: $${job.salaryMin} - $${job.salaryMax} (avg: $${avg})`);
    console.log(`   Period: ${job.salaryPeriod}, Currency: ${job.salaryCurrency}`);
    console.log(`   Created: ${job.createdAt.toISOString().split('T')[0]}`);
    console.log('');
  });

  // Calculate statistics (same as salary-insights.ts)
  const salaries = jobs
    .map(j => ((j.salaryMin || 0) + (j.salaryMax || 0)) / 2)
    .filter(s => s > 0)
    .sort((a, b) => a - b);

  console.log('\n📈 Salary Statistics:');
  console.log(`   Raw values: ${salaries.join(', ')}`);
  console.log(`   Min: $${salaries[0]}`);
  console.log(`   Max: $${salaries[salaries.length - 1]}`);
  console.log(`   25th percentile: $${salaries[Math.floor(salaries.length * 0.25)]}`);
  console.log(`   Median: $${salaries[Math.floor(salaries.length / 2)]}`);
  console.log(`   75th percentile: $${salaries[Math.floor(salaries.length * 0.75)]}`);
  console.log(`   Average: $${Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length)}`);

  // Check for suspicious values
  const suspicious = salaries.filter(s => s < 10000);
  if (suspicious.length > 0) {
    console.log(`\n⚠️  Warning: ${suspicious.length} salaries below $10,000 (likely hourly rates stored incorrectly):`);
    console.log(`   ${suspicious.join(', ')}`);
  }

  await prisma.$disconnect();
}

const jobTitle = process.argv[2] || 'Epic Professional Billing Analyst/Trainer';
debugSalaryCalculation(jobTitle);
