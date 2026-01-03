import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

// Short Video Maker config
const VIDEO_CONFIG = {
  voice: 'af_heart', // Warm female voice
  music: 'hopeful' as const,
  captionPosition: 'bottom' as const,
  orientation: 'portrait' as const,
  musicVolume: 'low' as const,
};

// Professional neutral backgrounds for remote work platform
// NO people/animals - only objects, screens, workspaces
const SCENE_VIDEOS = {
  // Tech - code on screen, no people
  tech: 'code on computer screen programming',
  design: 'design software interface screen',
  business: 'laptop keyboard coffee desk minimal',

  // Default - clean workspace aesthetic, no people
  professional: 'laptop desk workspace minimal aesthetic',
};

type SceneType = 'hook' | 'content' | 'salary' | 'cta';

interface Scene {
  text: string;      // TTS text (phonetic spelling)
  caption: string;   // Subtitle text (correct spelling)
  searchTerms: string[]; // Short Video Maker expects array
}

// Helper to wrap single term in array
function term(t: string): string[] {
  return [t];
}

// Convert salary for TTS (e.g., "$207K" -> "207 thousand dollars")
function salaryToTTS(salary: string): string {
  // Extract number and convert
  const match = salary.match(/\$?(\d+)K/i);
  if (match) {
    return `${match[1]} thousand dollars per year`;
  }
  return salary;
}

// Build SINGLE scene with all text combined
function buildJobAlertScenes(
  jobTitle: string,
  companyName: string,
  salary: string | null,
  location: string,
  jobType: string
): Scene[] {
  // Select background based on job type
  const isTech = /developer|engineer|programmer|devops|sre/i.test(jobTitle);
  const isDesign = /designer|ux|ui|creative/i.test(jobTitle);
  const background = isTech ? SCENE_VIDEOS.tech : isDesign ? SCENE_VIDEOS.design : SCENE_VIDEOS.professional;

  // TTS text (phonetic)
  const salaryTTS = salary ? `${salaryToTTS(salary)}.` : `${jobType} position.`;
  const ttsText = `Hot job alert! ${companyName} is hiring a ${jobTitle}. ${salaryTTS} ${location}. Apply now at freelan-lee dot com!`;

  // Caption text (correct spelling)
  const salaryCaption = salary ? `${salary}.` : `${jobType} position.`;
  const captionText = `Hot job alert! ${companyName} is hiring a ${jobTitle}. ${salaryCaption} ${location}. Apply now at freelanly.com!`;

  return [{
    text: ttsText,
    caption: captionText,
    searchTerms: term(background),
  }];
}

// Build SINGLE scene with all salary info
function buildSalaryRevealScenes(
  categoryName: string,
  entryRange: string | null,
  midRange: string | null,
  seniorRange: string | null
): Scene[] {
  const background = SCENE_VIDEOS.professional;

  // TTS parts
  const ttsParts = [`How much do Remote ${categoryName} make?`];
  if (entryRange) ttsParts.push(`Entry level: ${entryRange}.`);
  if (midRange) ttsParts.push(`Mid level: ${midRange}.`);
  if (seniorRange) ttsParts.push(`Senior level: ${seniorRange}.`);
  ttsParts.push("Find your salary at freelan-lee dot com!");

  // Caption parts
  const captionParts = [`How much do Remote ${categoryName} make?`];
  if (entryRange) captionParts.push(`Entry level: ${entryRange}.`);
  if (midRange) captionParts.push(`Mid level: ${midRange}.`);
  if (seniorRange) captionParts.push(`Senior level: ${seniorRange}.`);
  captionParts.push("Find your salary at freelanly.com!");

  return [{
    text: ttsParts.join(' '),
    caption: captionParts.join(' '),
    searchTerms: term(background),
  }];
}

// Build SINGLE scene with all top jobs
function buildTopJobsScenes(
  jobs: Array<{ title: string; company: string; salary: string }>
): Scene[] {
  const background = SCENE_VIDEOS.professional;

  // TTS parts
  const ttsParts = [`Top ${jobs.length} highest paying remote jobs!`];
  jobs.forEach((job, i) => {
    ttsParts.push(`Number ${i + 1}: ${job.title} at ${job.company}, ${salaryToTTS(job.salary)}.`);
  });
  ttsParts.push("Apply at freelan-lee dot com!");

  // Caption parts
  const captionParts = [`Top ${jobs.length} highest paying remote jobs!`];
  jobs.forEach((job, i) => {
    captionParts.push(`#${i + 1}: ${job.title} at ${job.company}, ${job.salary}.`);
  });
  captionParts.push("Apply at freelanly.com!");

  return [{
    text: ttsParts.join(' '),
    caption: captionParts.join(' '),
    searchTerms: term(background),
  }];
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
  // Get a featured job (prefer USD for international audience)
  const where: Prisma.JobWhereInput = jobId
    ? { id: jobId }
    : {
        salaryMin: { not: null },
        salaryCurrency: 'USD',
        salaryPeriod: 'YEAR',
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

  // Get salary stats (USD only for consistency)
  const jobs = await prisma.job.findMany({
    where: {
      categoryId: category.id,
      salaryMin: { not: null },
      salaryPeriod: 'YEAR',
      salaryCurrency: 'USD',
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
      salaryCurrency: 'USD', // Only USD to avoid currency confusion
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

  // Build SINGLE scene
  const background = SCENE_VIDEOS.professional;
  const ttsText = `${topCompany.name} is hiring! They have ${topCompany.count} open remote positions. Check them out at freelan-lee dot com!`;
  const captionText = `${topCompany.name} is hiring! They have ${topCompany.count} open remote positions. Check them out at freelanly.com!`;
  const scenes: Scene[] = [
    { text: ttsText, caption: captionText, searchTerms: term(background) },
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
  const currencySymbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$',
    INR: '₹', JPY: '¥', CNY: '¥', SGD: 'S$', HKD: 'HK$',
  };
  const symbol = currencySymbols[currency] || currency + ' ';

  const salary = job.salaryMax || job.salaryMin || 0;
  const salaryK = Math.round(salary / 1000);

  const periodMap: Record<string, string> = {
    HOUR: 'per hour', DAY: 'per day', WEEK: 'per week',
    MONTH: 'per month', YEAR: 'per year',
  };
  const period = periodMap[job.salaryPeriod || 'YEAR'] || 'per year';

  return `${symbol}${salaryK}K ${period}`;
}
