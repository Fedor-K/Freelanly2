import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

// Feed of SENT auto-applications with the WHY: for each sent application, show which candidate
// applied, their résumé, and the match reasoning that made us send it for THIS user to THIS
// opportunity — matchScore/label + the frozen per-skill matchBreakdown (which listing skills the
// candidate has vs is missing). The recruiter-facing mirror of /admin/imports (post sorting).

const PERIOD_HOURS: Record<string, number> = { '6h': 6, '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

type BreakdownLine = { type?: string; label?: string; status?: string; source?: string | null; evidence?: string | null };

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = request.nextUrl;
  const period = url.searchParams.get('period') || '24h';
  const label = url.searchParams.get('label') || 'all'; // all | Strong | Good | Weak | none
  const cv = url.searchParams.get('cv') || 'all'; // all | with | without
  const search = url.searchParams.get('search')?.trim() || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(250, Math.max(10, parseInt(url.searchParams.get('limit') || '50', 10)));

  const hours = PERIOD_HOURS[period] ?? 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const where: Record<string, unknown> = { sentAt: { gte: since, not: null } };
  if (label !== 'all') where.matchLabel = label === 'none' ? null : label;
  if (cv === 'with') where.user = { resumeUrl: { contains: 'blob.vercel-storage' } };
  if (cv === 'without') where.user = { OR: [{ resumeUrl: null }, { NOT: { resumeUrl: { contains: 'blob.vercel-storage' } } }] };
  if (search) {
    where.OR = [
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { opportunity: { title: { contains: search, mode: 'insensitive' } } },
      { appliedToEmail: { contains: search, mode: 'insensitive' } },
      { jobTitle: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, byLabelRows, apps] = await Promise.all([
    prisma.autoApplication.count({ where }),
    prisma.$queryRawUnsafe<Array<{ label: string | null; n: number }>>(
      `SELECT "matchLabel" label, CAST(COUNT(*) AS INT) n FROM "AutoApplication"
       WHERE "sentAt" >= $1 GROUP BY 1 ORDER BY 2 DESC`,
      since,
    ),
    prisma.autoApplication.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, sentAt: true, jobTitle: true, appliedToEmail: true, opportunityId: true,
        matchScore: true, matchLabel: true, matchBreakdown: true, coverLetter: true, status: true,
        user: {
          select: {
            name: true, parsedProfile: true, resumeUrl: true, resumeFileName: true, resumeGenerated: true,
            resumeText: true,
          },
        },
      },
    }),
  ]);

  const byLabel: Record<string, number> = {};
  for (const r of byLabelRows) byLabel[r.label || 'none'] = r.n;

  // AutoApplication has no `opportunity` relation (only opportunityId) — fetch titles/slugs in one go.
  const oppIds = [...new Set(apps.map((a) => a.opportunityId).filter((x): x is string => !!x))];
  const opps = oppIds.length
    ? await prisma.opportunity.findMany({ where: { id: { in: oppIds } }, select: { id: true, title: true, slug: true, description: true } })
    : [];
  const oppMap = new Map(opps.map((o) => [o.id, o]));

  const rows = apps.map((a) => {
    const prof = (a.user?.parsedProfile ?? {}) as Record<string, unknown>;
    const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(String) : []);
    const bd = (a.matchBreakdown ?? null) as { matched?: number; total?: number; lines?: BreakdownLine[] } | null;
    const lines = Array.isArray(bd?.lines) ? bd!.lines! : [];
    const resumeUrl = a.user?.resumeUrl || null;
    const hasBlobCv = !!resumeUrl && resumeUrl.includes('blob.vercel-storage');
    const opp = a.opportunityId ? oppMap.get(a.opportunityId) : null;
    return {
      id: a.id,
      sentAt: a.sentAt?.toISOString() ?? null,
      status: a.status,
      candidate: {
        name: a.user?.name || 'Unknown',
        title: (prof.current_title as string) || null,
        location: (prof.location as string) || null,
        experienceYears: typeof prof.experience_years === 'number' ? prof.experience_years : null,
        skills: arr(prof.skills).slice(0, 25),
        cvUrl: hasBlobCv ? resumeUrl : null,
        cvName: a.user?.resumeFileName || null,
        cvGenerated: !!a.user?.resumeGenerated,
        hasResumeText: !!(a.user?.resumeText && a.user.resumeText.length > 0),
      },
      jobTitle: opp?.title || a.jobTitle || null,
      jobSlug: opp?.slug || null,
      jobDescription: opp?.description ? opp.description.slice(0, 1500) : null,
      recruiterEmail: a.appliedToEmail || null,
      matchScore: a.matchScore,
      matchLabel: a.matchLabel,
      match: bd
        ? {
            matched: bd.matched ?? lines.filter((l) => l.status === 'full' || l.status === 'partial').length,
            total: bd.total ?? lines.length,
            lines: lines.slice(0, 30).map((l) => ({
              label: l.label || '',
              status: l.status || 'missing',
              source: l.source || null,
              evidence: l.evidence || null,
            })),
          }
        : null,
      coverLetter: a.coverLetter ? a.coverLetter.slice(0, 2000) : null,
    };
  });

  return NextResponse.json({ period, label, cv, search, page, limit, total, byLabel, rows });
}
