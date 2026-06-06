import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { computeCaveats, explainDecision } from '@/lib/match-caveats';

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

// Audit of processed pairings, GROUPED BY VACANCY. The flat row feed buried the sent rows under a
// single run's ~250 rejections (one mega-vacancy = a whole row-page). Now the list is paginated by
// VACANCY (jobTitle + recruiter) with sent/rejected counts; the individual candidates for a vacancy
// are lazy-loaded on expand (?group=1&gjt=<title>&gem=<recruiter email>).

const PERIOD_HOURS: Record<string, number> = { '6h': 6, '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };
const GROUPS_PER_PAGE = 40;

type BreakdownLine = { type?: string; label?: string; status?: string; source?: string | null; evidence?: string | null };

const APP_SELECT = {
  id: true, sentAt: true, createdAt: true, jobTitle: true, appliedToEmail: true, opportunityId: true,
  matchScore: true, matchLabel: true, matchBreakdown: true, coverLetter: true, status: true,
  user: { select: { name: true, parsedProfile: true, resumeUrl: true, resumeFileName: true, linkedinUrl: true, resumeText: true } },
} satisfies Prisma.AutoApplicationSelect;

type AppRow = Prisma.AutoApplicationGetPayload<{ select: typeof APP_SELECT }>;

// Build the rich Row objects (candidate profile + match breakdown + conversation) for a set of apps.
async function buildRows(apps: AppRow[]) {
  const oppIds = [...new Set(apps.map((a) => a.opportunityId).filter((x): x is string => !!x))];
  const opps = oppIds.length
    ? await prisma.opportunity.findMany({ where: { id: { in: oppIds } }, select: { id: true, title: true, slug: true, description: true } })
    : [];
  const oppMap = new Map(opps.map((o) => [o.id, o]));

  const appIds = apps.map((a) => a.id);
  const messages = appIds.length
    ? await prisma.message.findMany({
        where: { applicationId: { in: appIds } },
        orderBy: { createdAt: 'asc' },
        select: { applicationId: true, from: true, text: true, attachmentUrl: true, createdAt: true },
      })
    : [];
  const msgMap = new Map<string, { from: string; text: string; attachmentUrl: string | null; at: string }[]>();
  for (const m of messages) {
    const a = msgMap.get(m.applicationId) ?? [];
    a.push({ from: m.from, text: (m.text || '').slice(0, 4000), attachmentUrl: m.attachmentUrl || null, at: m.createdAt.toISOString() });
    msgMap.set(m.applicationId, a);
  }

  return apps.map((a) => {
    const prof = (a.user?.parsedProfile ?? {}) as Record<string, unknown>;
    const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(String) : []);
    const bd = (a.matchBreakdown ?? null) as { matched?: number; total?: number; lines?: BreakdownLine[] } | null;
    const lines = Array.isArray(bd?.lines) ? bd!.lines! : [];
    const resumeUrl = a.user?.resumeUrl || null;
    const hasBlobCv = !!resumeUrl && resumeUrl.includes('blob.vercel-storage');
    const opp = a.opportunityId ? oppMap.get(a.opportunityId) : null;
    const sent = !!a.sentAt;
    const bdFull = (a.matchBreakdown ?? {}) as Record<string, unknown>;
    return {
      id: a.id,
      sentAt: a.sentAt?.toISOString() ?? null,
      at: (a.sentAt ?? a.createdAt)?.toISOString() ?? null,
      sent,
      decision: sent ? 'SEND' : 'NO',
      gateReason: typeof bdFull.gateReason === 'string' ? bdFull.gateReason : null,
      status: a.status,
      candidate: {
        name: a.user?.name || 'Unknown',
        title: (prof.current_title as string) || null,
        location: (prof.location as string) || null,
        experienceYears: typeof prof.experience_years === 'number' ? prof.experience_years : null,
        skills: arr(prof.skills).slice(0, 25),
        languages: arr(prof.languages).slice(0, 8),
        summary: (prof.summary as string) || null,
        linkedinUrl: a.user?.linkedinUrl || null,
        experience: (Array.isArray(prof.experience) ? (prof.experience as Array<Record<string, unknown>>) : []).slice(0, 8).map((e) => ({
          title: String(e?.title || ''), company: String(e?.company || ''), dates: String(e?.dates || ''), description: String(e?.description || ''),
        })).filter((e) => e.title || e.company),
        education: (Array.isArray(prof.education) ? (prof.education as Array<Record<string, unknown>>) : []).slice(0, 5).map((e) => ({
          degree: String(e?.degree || ''), school: String(e?.school || e?.institution || ''), dates: String(e?.dates || ''),
        })).filter((e) => e.degree || e.school),
        certifications: arr(prof.certifications).slice(0, 10),
        cvUrl: hasBlobCv ? resumeUrl : null,
        cvName: a.user?.resumeFileName || null,
        hasResumeText: !!(a.user?.resumeText && a.user.resumeText.length > 0),
      },
      jobTitle: opp?.title || a.jobTitle || null,
      jobSlug: opp?.slug || null,
      jobDescription: opp?.description ? opp.description.slice(0, 1500) : null,
      recruiterEmail: a.appliedToEmail || null,
      matchScore: a.matchScore,
      matchLabel: a.matchLabel,
      match: bd ? {
        matched: bd.matched ?? lines.filter((l) => l.status === 'full' || l.status === 'partial').length,
        total: bd.total ?? lines.length,
        lines: lines.slice(0, 30).map((l) => ({ label: l.label || '', status: l.status || 'missing', source: l.source || null, evidence: l.evidence || null })),
      } : null,
      coverLetter: a.coverLetter ? a.coverLetter.slice(0, 2000) : null,
      conversation: msgMap.get(a.id) ?? [],
      recruiterReplied: (msgMap.get(a.id) ?? []).some((m) => m.from === 'recruiter'),
      caveats: computeCaveats(a.matchBreakdown),
      reasoning: explainDecision(a.matchBreakdown, { sent, gateReason: typeof bdFull.gateReason === 'string' ? bdFull.gateReason : null }),
      recruiterReasoning: (typeof (a.matchBreakdown as Record<string, unknown> | null)?.recruiterReasoning === 'string'
        ? (a.matchBreakdown as Record<string, string>).recruiterReasoning : null),
    };
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = request.nextUrl;
  const period = url.searchParams.get('period') || '24h';
  const label = url.searchParams.get('label') || 'all';
  const cv = url.searchParams.get('cv') || 'all';
  const search = url.searchParams.get('search')?.trim() || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const statusFilter = url.searchParams.get('status') || 'all';
  const hours = PERIOD_HOURS[period] ?? 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  // Shared filter — every processed pairing (sent or rejected) in the period.
  const where: Prisma.AutoApplicationWhereInput = { createdAt: { gte: since }, status: { notIn: ['PENDING', 'SENDING', 'REVIEW'] } };
  if (statusFilter === 'sent') where.sentAt = { not: null };
  if (statusFilter === 'rejected') where.status = 'REJECTED';
  if (label !== 'all') where.matchLabel = label === 'none' ? null : label;
  if (cv === 'with') where.user = { resumeUrl: { contains: 'blob.vercel-storage' } };
  if (cv === 'without') where.user = { OR: [{ resumeUrl: null }, { NOT: { resumeUrl: { contains: 'blob.vercel-storage' } } }] };
  if (search) {
    where.OR = [
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { appliedToEmail: { contains: search, mode: 'insensitive' } },
      { jobTitle: { contains: search, mode: 'insensitive' } },
    ];
  }

  // LAZY mode — all candidates for ONE vacancy (jobTitle + recruiter), loaded on expand.
  if (url.searchParams.get('group')) {
    const gjt = url.searchParams.get('gjt');
    const gem = url.searchParams.get('gem');
    const gwhere: Prisma.AutoApplicationWhereInput = { ...where, jobTitle: gjt ?? '', appliedToEmail: gem ?? '' };
    const apps = await prisma.autoApplication.findMany({
      where: gwhere,
      orderBy: [{ sentAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 600,
      select: APP_SELECT,
    });
    const rows = await buildRows(apps);
    return NextResponse.json({ rows });
  }

  // GROUPED mode — paginate by vacancy.
  const [allGroups, sentGroups, rejGroups, byLabelRows, statusRows] = await Promise.all([
    prisma.autoApplication.groupBy({
      by: ['jobTitle', 'appliedToEmail'], where, _count: { _all: true }, _max: { createdAt: true, sentAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
    }),
    prisma.autoApplication.groupBy({ by: ['jobTitle', 'appliedToEmail'], where: { ...where, sentAt: { not: null } }, _count: { _all: true } }),
    prisma.autoApplication.groupBy({ by: ['jobTitle', 'appliedToEmail'], where: { ...where, status: 'REJECTED' }, _count: { _all: true } }),
    prisma.$queryRawUnsafe<Array<{ label: string | null; n: number }>>(
      `SELECT "matchLabel" label, CAST(COUNT(*) AS INT) n FROM "AutoApplication"
       WHERE "createdAt" >= $1 AND status NOT IN ('PENDING','SENDING','REVIEW') GROUP BY 1 ORDER BY 2 DESC`, since),
    prisma.$queryRawUnsafe<Array<{ sent: boolean; n: number }>>(
      `SELECT ("sentAt" IS NOT NULL) sent, CAST(COUNT(*) AS INT) n FROM "AutoApplication"
       WHERE "createdAt" >= $1 AND status NOT IN ('PENDING','SENDING','REVIEW') GROUP BY 1`, since),
  ]);

  const keyOf = (jt: string | null, em: string | null) => `${jt ?? ''}${em ?? ''}`;
  const sentMap = new Map(sentGroups.map((g) => [keyOf(g.jobTitle, g.appliedToEmail), g._count._all]));
  const rejMap = new Map(rejGroups.map((g) => [keyOf(g.jobTitle, g.appliedToEmail), g._count._all]));

  const byLabel: Record<string, number> = {};
  for (const r of byLabelRows) byLabel[r.label || 'none'] = r.n;
  const byStatus = { sent: 0, rejected: 0 };
  for (const r of statusRows) { if (r.sent) byStatus.sent = r.n; else byStatus.rejected = r.n; }

  const totalGroups = allGroups.length;
  const total = allGroups.reduce((s, g) => s + g._count._all, 0);
  const pageGroups = allGroups.slice((page - 1) * GROUPS_PER_PAGE, page * GROUPS_PER_PAGE).map((g) => {
    const key = keyOf(g.jobTitle, g.appliedToEmail);
    return {
      jobTitle: g.jobTitle,
      recruiterEmail: g.appliedToEmail,
      sent: sentMap.get(key) || 0,
      rejected: rejMap.get(key) || 0,
      total: g._count._all,
      lastAt: (g._max.sentAt ?? g._max.createdAt)?.toISOString() ?? null,
    };
  });

  return NextResponse.json({
    mode: 'grouped', period, label, cv, search, status: statusFilter, page,
    groupsPerPage: GROUPS_PER_PAGE, totalGroups, total, byLabel, byStatus, groups: pageGroups,
  });
}
