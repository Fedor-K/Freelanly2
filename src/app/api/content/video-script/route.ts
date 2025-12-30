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

// TESTED Pexels search terms - single specific terms that return professional videos
// Using single terms (not arrays) for more predictable results
const SCENE_VIDEOS = {
  // Hook scenes - attention grabbing, energetic
  hook: 'woman office professional',

  // Work/content scenes by job category
  tech: 'man working laptop',
  design: 'creative designer working',
  business: 'business laptop',
  remote: 'person computer office',

  // Salary/money scenes
  money: 'money cash dollars',

  // CTA scenes - positive, action-oriented
  cta: 'happy business success',

  // Generic professional scenes
  professional: 'typing keyboard office',
};

type SceneType = 'hook' | 'content' | 'salary' | 'cta';

interface Scene {
  text: string;
  searchTerms: string[]; // Short Video Maker expects array
}

// Helper to wrap single term in array
function term(t: string): string[] {
  return [t];
}

// Build scenes with fixed structure: HOOK → CONTENT → CTA
function buildJobAlertScenes(
  jobTitle: string,
  companyName: string,
  salary: string | null,
  location: string,
  jobType: string
): Scene[] {
  const scenes: Scene[] = [];

  // Scene 1: HOOK (attention grabber)
  scenes.push({
    text: "Hot job alert!",
    searchTerms: term(SCENE_VIDEOS.hook),
  });

  // Scene 2: COMPANY + ROLE (main content)
  const isTech = /developer|engineer|programmer|devops|sre/i.test(jobTitle);
  const isDesign = /designer|ux|ui|creative/i.test(jobTitle);
  const videoTerm = isTech ? SCENE_VIDEOS.tech : isDesign ? SCENE_VIDEOS.design : SCENE_VIDEOS.business;

  scenes.push({
    text: `${companyName} is hiring a ${jobTitle}.`,
    searchTerms: term(videoTerm),
  });

  // Scene 3: SALARY + LOCATION (if salary exists)
  if (salary) {
    scenes.push({
      text: `${salary}. ${location}.`,
      searchTerms: term(SCENE_VIDEOS.money),
    });
  } else {
    scenes.push({
      text: `Location: ${location}. ${jobType} position.`,
      searchTerms: term(SCENE_VIDEOS.remote),
    });
  }

  // Scene 4: CTA
  scenes.push({
    text: "Apply now at freelanly dot com!",
    searchTerms: term(SCENE_VIDEOS.cta),
  });

  return scenes;
}

function buildSalaryRevealScenes(
  categoryName: string,
  entryRange: string | null,
  midRange: string | null,
  seniorRange: string | null
): Scene[] {
  const scenes: Scene[] = [];

  scenes.push({
    text: `How much do Remote ${categoryName} make?`,
    searchTerms: term(SCENE_VIDEOS.hook),
  });

  if (entryRange) {
    scenes.push({
      text: `Entry level: ${entryRange}.`,
      searchTerms: term(SCENE_VIDEOS.money),
    });
  }

  if (midRange) {
    scenes.push({
      text: `Mid level: ${midRange}.`,
      searchTerms: term(SCENE_VIDEOS.money),
    });
  }

  if (seniorRange) {
    scenes.push({
      text: `Senior level: ${seniorRange}.`,
      searchTerms: term(SCENE_VIDEOS.money),
    });
  }

  scenes.push({
    text: "Find your salary at freelanly dot com!",
    searchTerms: term(SCENE_VIDEOS.cta),
  });

  return scenes;
}

function buildTopJobsScenes(
  jobs: Array<{ title: string; company: string; salary: string }>
): Scene[] {
  const scenes: Scene[] = [];

  scenes.push({
    text: `Top ${jobs.length} highest paying remote jobs!`,
    searchTerms: term(SCENE_VIDEOS.hook),
  });

  jobs.forEach((job, i) => {
    scenes.push({
      text: `Number ${i + 1}: ${job.title} at ${job.company}, ${job.salary}.`,
      searchTerms: term(i === 0 ? SCENE_VIDEOS.money : SCENE_VIDEOS.professional),
    });
  });

  scenes.push({
    text: "Apply at freelanly dot com!",
    searchTerms: term(SCENE_VIDEOS.cta),
  });

  return scenes;
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
  const jobType = job.type.replace('_', ' ').toLowerCase();

  // Build structured scenes
  const scenes = buildJobAlertScenes(
    job.title,
    job.company.name,
    salary,
    location,
    jobType
  );

  // Also build a readable script
  const script = scenes.map(s => s.text).join(' ');

  return NextResponse.json({
    success: true,
    type: 'job-alert',
    jobId: job.id,
    jobUrl: `https://freelanly.com/company/${job.company.slug}/jobs/${job.slug}`,
    script,
    scenes,
    config: VIDEO_CONFIG,
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

  // Build structured scenes
  const scenes = buildSalaryRevealScenes(category.name, entry, mid, senior);
  const script = scenes.map(s => s.text).join(' ');

  return NextResponse.json({
    success: true,
    type: 'salary-reveal',
    category: category.name,
    script,
    scenes,
    config: VIDEO_CONFIG,
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

  // Build structured scenes
  const jobsForScenes = jobs.map(job => ({
    title: job.title,
    company: job.company.name,
    salary: `$${Math.round((job.salaryMax || job.salaryMin || 0) / 1000)}K`,
  }));

  const scenes = buildTopJobsScenes(jobsForScenes);
  const script = scenes.map(s => s.text).join(' ');

  return NextResponse.json({
    success: true,
    type: 'top-jobs',
    count: jobs.length,
    script,
    scenes,
    config: VIDEO_CONFIG,
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

  // Build structured scenes
  const scenes: Scene[] = [
    { text: `${topCompany.name} is hiring!`, searchTerms: term(SCENE_VIDEOS.hook) },
    { text: `They have ${topCompany.count} open remote positions.`, searchTerms: term(SCENE_VIDEOS.business) },
    { text: `Check them out at freelanly dot com!`, searchTerms: term(SCENE_VIDEOS.cta) },
  ];

  const script = scenes.map(s => s.text).join(' ');

  return NextResponse.json({
    success: true,
    type: 'company-hiring',
    company: topCompany.name,
    openPositions: topCompany.count,
    script,
    scenes,
    config: VIDEO_CONFIG,
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
