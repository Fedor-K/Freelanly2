import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Short Video Maker config
const VIDEO_CONFIG = {
  voice: 'af_heart', // Warm female voice
  music: 'hopeful' as const,
  captionPosition: 'bottom' as const,
  orientation: 'portrait' as const,
  musicVolume: 'low' as const,
};

// Search terms by topic for Pexels background videos
const SEARCH_TERMS: Record<string, string[]> = {
  job: ['remote work', 'laptop office'],
  hiring: ['business meeting', 'team collaboration'],
  salary: ['money success', 'business growth'],
  developer: ['coding programming', 'software developer'],
  designer: ['creative design', 'digital art'],
  marketing: ['digital marketing', 'social media'],
  cta: ['career success', 'happy professional'],
  company: ['modern office', 'corporate building'],
  remote: ['home office', 'work from home'],
  default: ['professional business', 'office work'],
};

function getSearchTerms(text: string): string[] {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('developer') || lowerText.includes('engineer')) return SEARCH_TERMS.developer;
  if (lowerText.includes('designer') || lowerText.includes('design')) return SEARCH_TERMS.designer;
  if (lowerText.includes('marketing')) return SEARCH_TERMS.marketing;
  if (lowerText.includes('salary') || lowerText.includes('$') || lowerText.includes('€')) return SEARCH_TERMS.salary;
  if (lowerText.includes('hiring') || lowerText.includes('position')) return SEARCH_TERMS.hiring;
  if (lowerText.includes('apply') || lowerText.includes('freelanly')) return SEARCH_TERMS.cta;
  if (lowerText.includes('remote')) return SEARCH_TERMS.remote;
  if (lowerText.includes('company') || lowerText.includes('corp')) return SEARCH_TERMS.company;
  if (lowerText.includes('job') || lowerText.includes('alert')) return SEARCH_TERMS.job;
  return SEARCH_TERMS.default;
}

function textToScenes(text: string): Array<{ text: string; searchTerms: string[] }> {
  // Split by sentences or logical breaks
  const sentences = text
    .split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences.map(sentence => ({
    text: sentence,
    searchTerms: getSearchTerms(sentence),
  }));
}

/**
 * GET /api/content/video-script
 * Returns ready-to-use video scripts for Short Video Maker
 *
 * Query params:
 * - type: script type (job-alert, salary-reveal, top-jobs, company-hiring)
 * - category: category slug (optional, for salary-reveal)
 * - jobId: specific job ID (optional, for job-alert)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'job-alert';
    const category = searchParams.get('category');
    const jobId = searchParams.get('jobId');

    switch (type) {
      case 'job-alert':
        return await generateJobAlertScript(jobId);
      case 'salary-reveal':
        return await generateSalaryRevealScript(category);
      case 'top-jobs':
        return await generateTopJobsScript(category);
      case 'company-hiring':
        return await generateCompanyHiringScript();
      default:
        return NextResponse.json(
          { error: 'Invalid type. Use: job-alert, salary-reveal, top-jobs, company-hiring' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[VideoScript] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate script' },
      { status: 500 }
    );
  }
}

async function generateJobAlertScript(jobId: string | null) {
  // Get a featured job
  const where = jobId
    ? { id: jobId }
    : {
        salaryMin: { not: null },
        postedAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      };

  const jobs = await prisma.job.findMany({
    where,
    include: { company: true },
    orderBy: { postedAt: 'desc' },
    take: 20,
  });

  if (jobs.length === 0) {
    return NextResponse.json({ error: 'No jobs found' }, { status: 404 });
  }

  const job = jobId ? jobs[0] : jobs[Math.floor(Math.random() * jobs.length)];

  const salary = formatSalary(job);
  const location = job.location || 'Remote';

  const script = `Hot job alert!
${job.company.name} is hiring a ${job.title}.
${salary ? `Salary: ${salary}.` : ''}
Location: ${location}.
This is a ${job.type.replace('_', ' ').toLowerCase()} position.
Apply now at freelanly dot com.
Link in bio!`;

  return NextResponse.json({
    success: true,
    type: 'job-alert',
    jobId: job.id,
    jobUrl: `https://freelanly.com/company/${job.company.slug}/jobs/${job.slug}`,
    script,
    // Ready for Short Video Maker API
    shortVideoMaker: {
      scenes: textToScenes(script),
      config: VIDEO_CONFIG,
    },
  });
}

async function generateSalaryRevealScript(categorySlug: string | null) {
  // Get a random category if not specified
  let category;
  if (categorySlug) {
    category = await prisma.category.findUnique({ where: { slug: categorySlug } });
  } else {
    const categories = await prisma.category.findMany({ take: 10 });
    category = categories[Math.floor(Math.random() * categories.length)];
  }

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  // Get salary stats
  const jobs = await prisma.job.findMany({
    where: {
      categoryId: category.id,
      salaryMin: { not: null },
      salaryPeriod: 'YEAR',
    },
    select: { salaryMin: true, salaryMax: true, level: true },
  });

  const byLevel: Record<string, number[]> = { ENTRY: [], MID: [], SENIOR: [] };
  for (const job of jobs) {
    const salary = job.salaryMax || job.salaryMin || 0;
    if (byLevel[job.level]) byLevel[job.level].push(salary);
  }

  const getRange = (arr: number[]) => {
    if (arr.length === 0) return null;
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    return `$${Math.round(min / 1000)}K to $${Math.round(max / 1000)}K`;
  };

  const entry = getRange(byLevel.ENTRY);
  const mid = getRange(byLevel.MID);
  const senior = getRange(byLevel.SENIOR);

  const script = `How much do Remote ${category.name} professionals make?
${entry ? `Entry level: ${entry} per year.` : ''}
${mid ? `Mid level: ${mid} per year.` : ''}
${senior ? `Senior level: ${senior} per year.` : ''}
Find these jobs at freelanly dot com.`;

  return NextResponse.json({
    success: true,
    type: 'salary-reveal',
    category: category.name,
    script,
    shortVideoMaker: {
      scenes: textToScenes(script),
      config: VIDEO_CONFIG,
    },
  });
}

async function generateTopJobsScript(categorySlug: string | null) {
  const jobs = await prisma.job.findMany({
    where: {
      salaryMin: { gte: 1 },
      salaryPeriod: 'YEAR',
      postedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      ...(categorySlug && { category: { slug: categorySlug } }),
    },
    include: { company: true },
    orderBy: { salaryMax: 'desc' },
    take: 3,
  });

  if (jobs.length === 0) {
    return NextResponse.json({ error: 'No jobs found' }, { status: 404 });
  }

  const jobLines = jobs.map((job, i) => {
    const salary = job.salaryMax || job.salaryMin || 0;
    return `Number ${i + 1}: ${job.title} at ${job.company.name}, ${Math.round(salary / 1000)}K per year.`;
  });

  const script = `${jobs.length} highest paying remote jobs this week!
${jobLines.join('\n')}
Apply at freelanly dot com. Link in bio!`;

  return NextResponse.json({
    success: true,
    type: 'top-jobs',
    count: jobs.length,
    script,
    shortVideoMaker: {
      scenes: textToScenes(script),
      config: VIDEO_CONFIG,
    },
  });
}

async function generateCompanyHiringScript() {
  // Find company with most recent jobs
  const recentJobs = await prisma.job.findMany({
    where: {
      postedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    include: { company: true },
    orderBy: { postedAt: 'desc' },
    take: 100,
  });

  // Count by company
  const companyCounts: Record<string, { name: string; count: number; logo: string | null }> = {};
  for (const job of recentJobs) {
    if (!companyCounts[job.companyId]) {
      companyCounts[job.companyId] = { name: job.company.name, count: 0, logo: job.company.logo };
    }
    companyCounts[job.companyId].count++;
  }

  // Get top company
  const topCompany = Object.values(companyCounts).sort((a, b) => b.count - a.count)[0];

  if (!topCompany) {
    return NextResponse.json({ error: 'No companies found' }, { status: 404 });
  }

  const script = `${topCompany.name} is hiring!
They have ${topCompany.count} open remote positions right now.
Check them out at freelanly dot com.
Link in bio!`;

  return NextResponse.json({
    success: true,
    type: 'company-hiring',
    company: topCompany.name,
    openPositions: topCompany.count,
    script,
    shortVideoMaker: {
      scenes: textToScenes(script),
      config: VIDEO_CONFIG,
    },
  });
}

function formatSalary(job: {
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
}): string | null {
  if (!job.salaryMin && !job.salaryMax) return null;

  const currency = job.salaryCurrency || 'USD';
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  const salary = job.salaryMax || job.salaryMin || 0;
  const salaryK = Math.round(salary / 1000);

  const periodMap: Record<string, string> = {
    HOUR: 'per hour', DAY: 'per day', WEEK: 'per week',
    MONTH: 'per month', YEAR: 'per year',
  };
  const period = periodMap[job.salaryPeriod || 'YEAR'] || 'per year';

  return `${symbol}${salaryK}K ${period}`;
}
