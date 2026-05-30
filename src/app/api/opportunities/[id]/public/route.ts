import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Opportunity/Job store salary as min/max/currency/period (no denormalized text column),
// so build the display string here.
const PERIOD_SUFFIX: Record<string, string> = { HOUR: '/hr', DAY: '/day', WEEK: '/wk', MONTH: '/mo', YEAR: '/yr' };
function formatSalary(min: number | null, max: number | null, currency: string | null, period: string | null): string | null {
  if (min == null && max == null) return null;
  const cur = currency || 'USD';
  const suffix = period ? PERIOD_SUFFIX[period] || '' : '';
  const fmt = (n: number) => n.toLocaleString();
  if (min != null && max != null && min !== max) return `${cur} ${fmt(min)}–${fmt(max)}${suffix}`;
  return `${cur} ${fmt((min ?? max) as number)}${suffix}`;
}

/**
 * GET /api/opportunities/[id]/public — Public project page data
 * No auth required. Used by the public project page for conversion.
 * Does NOT expose recruiter emails or internal data.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try opportunity first, then job
    let project: {
      id: string;
      title: string;
      description: string;
      companyName: string;
      source: string;
      sourceUrl: string | null;
      skills: string[];
      locationType: string | null;
      salary: string | null;
      level: string | null;
      createdAt: Date;
      type: 'opportunity' | 'job';
    } | null = null;

    const opp = await prisma.opportunity.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        sourceUrl: true,
        skills: true,
        locationType: true,
        level: true,
        createdAt: true,
        clientName: true,
        clientLinkedIn: true,
        clientHeadline: true,
        clientAvatar: true,
        posterTitle: true,
        posterCompany: true,
        posterFollowers: true,
        company: { select: { name: true } },
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        salaryPeriod: true,
      },
    });

    if (opp) {
      project = {
        id: opp.id,
        title: opp.title,
        description: opp.description || '',
        companyName: opp.company?.name || opp.posterCompany || opp.clientName || 'Unknown',
        source: 'linkedin',
        sourceUrl: opp.sourceUrl || null,
        skills: opp.skills || [],
        locationType: opp.locationType,
        salary: formatSalary(opp.salaryMin, opp.salaryMax, opp.salaryCurrency, opp.salaryPeriod),
        level: opp.level,
        createdAt: opp.createdAt,
        type: 'opportunity',
      };
    } else {
      const job = await prisma.job.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          description: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          salaryPeriod: true,
          skills: true,
          level: true,
          locationType: true,
          sourceUrl: true,
          createdAt: true,
          company: { select: { name: true } },
          category: { select: { name: true } },
        },
      });

      if (job) {
        project = {
          id: job.id,
          title: job.title,
          description: job.description || '',
          companyName: job.company?.name || 'Unknown',
          source: 'career_page',
          sourceUrl: job.sourceUrl || null,
          skills: job.skills || [],
          locationType: job.locationType,
          salary: formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod),
          level: job.level,
          createdAt: job.createdAt,
          type: 'job',
        };
      }
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Time since posted
    const minutesAgo = Math.round((Date.now() - project.createdAt.getTime()) / 60000);
    const postedAgo = minutesAgo < 60
      ? `${minutesAgo} minutes ago`
      : minutesAgo < 1440
        ? `${Math.round(minutesAgo / 60)} hours ago`
        : `${Math.round(minutesAgo / 1440)} days ago`;

    // How many applications sent to this project
    const applicationCount = await prisma.autoApplication.count({
      where: project.type === 'opportunity'
        ? { opportunityId: project.id, status: { in: ['SENT', 'OPENED', 'REPLIED'] } }
        : { jobId: project.id, status: { in: ['SENT', 'OPENED', 'REPLIED'] } },
    });

    // AI application preview (generic, blurred on frontend)
    const previewCoverLetter = `Hi [Hiring Manager],\n\nSaw your post — I've [relevant experience] using [matching skills], and it's the work I'm most excited about. [Specific achievement that maps to this role].\n\nI'm [location], available [timeframe]. Quick call this week?\n\n— [Your Name]`;

    // Similar projects (3 recent from same category)
    const similar = await prisma.opportunity.findMany({
      where: {
        id: { not: project.id },
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
      select: { id: true, title: true, clientName: true, company: { select: { name: true } }, salaryMin: true, salaryMax: true, salaryCurrency: true, salaryPeriod: true, skills: true, createdAt: true },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    // Total open projects count
    const totalProjects = await prisma.opportunity.count({
      where: { createdAt: { gte: new Date(Date.now() - 14 * 86400000) } },
    });

    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        companyName: project.companyName,
        source: project.source,
        sourceUrl: project.sourceUrl,
        skills: project.skills,
        locationType: project.locationType,
        salary: project.salary,
        level: project.level,
        postedAgo,
        type: project.type,
      },
      poster: project.type === 'opportunity' && opp ? {
        name: opp.clientName,
        headline: opp.posterTitle || opp.clientHeadline,
        company: opp.posterCompany,
        avatar: opp.clientAvatar,
        linkedIn: opp.clientLinkedIn,
        followers: opp.posterFollowers,
      } : null,
      signals: {
        applicationCount,
        isEarly: applicationCount < 20,
        postedMinutesAgo: minutesAgo,
      },
      preview: {
        coverLetter: previewCoverLetter,
        generateTime: '19s',
      },
      similar: similar.map((s, i) => ({
        id: s.id,
        title: s.title,
        companyName: s.company?.name || s.clientName || 'Unknown',
        salary: formatSalary(s.salaryMin, s.salaryMax, s.salaryCurrency, s.salaryPeriod),
        skills: (s.skills || []).slice(0, 3),
        locked: i > 0, // first one visible, rest locked
      })),
      totalProjects,
      cta: `This is 1 of ${totalProjects.toLocaleString()} open projects. Sign up — AI applies to all of them for you.`,
    });
  } catch (error) {
    console.error('[PublicProject] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
