import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

// Per-post webhook activity feed: unified timeline of every incoming LinkedIn post
// with the AI's decision (created OR skipped) and the AI's specific reason.
// Reads two sources:
//   - Opportunity (status: 'created') — successful imports
//   - ActivityLog action='IMPORT_SKIP' — every rejection with reason + aiReason
// and merges them into a single chronological stream so admin can see WHY each
// post was accepted or rejected, in real time.

const PERIOD_HOURS: Record<string, number> = {
  '1h': 1,
  '6h': 6,
  '24h': 24,
  '7d': 24 * 7,
};

export async function GET(request: NextRequest) {
  // Auth — admin only
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = request.nextUrl;
  const period = url.searchParams.get('period') || '6h';
  const status = url.searchParams.get('status') || 'all'; // all | created | skipped
  const reason = url.searchParams.get('reason') || 'all'; // all | not_job_posting | non-target profession | duplicate | etc
  const search = url.searchParams.get('search')?.toLowerCase() || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(250, Math.max(10, parseInt(url.searchParams.get('limit') || '50', 10)));

  const hours = PERIOD_HOURS[period] ?? 6;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  // 1) Summary stats for the period
  const [createdTotal, skipByReasonRows] = await Promise.all([
    prisma.opportunity.count({ where: { createdAt: { gte: since } } }),
    prisma.$queryRawUnsafe<Array<{ reason: string; n: number }>>(
      `SELECT details->>'reason' reason, CAST(COUNT(*) AS INT) n
       FROM "ActivityLog" WHERE action='IMPORT_SKIP' AND "createdAt" >= $1
       GROUP BY 1 ORDER BY 2 DESC`,
      since,
    ),
  ]);
  const skipTotal = skipByReasonRows.reduce((s, r) => s + r.n, 0);
  const skipByReason: Record<string, number> = {};
  for (const r of skipByReasonRows) skipByReason[r.reason || 'unknown'] = r.n;

  // 2) AI-reason histogram for not_job_posting (the "why AI rejected" view)
  const aiReasonRows = await prisma.$queryRawUnsafe<Array<{ aireason: string | null; n: number }>>(
    `SELECT details->>'aiReason' aireason, CAST(COUNT(*) AS INT) n
     FROM "ActivityLog"
     WHERE action='IMPORT_SKIP' AND details->>'reason'='not_job_posting' AND "createdAt" >= $1
     GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
    since,
  );

  // 3) Unified row stream — fetch both, merge, paginate.
  // Strategy: pull (page * limit) + buffer from each, merge by time, slice.
  const fetchSize = page * limit + 200;

  // Build queries respecting status + reason filters
  type Row = {
    id: string;
    createdAt: string;
    status: 'created' | 'skipped';
    title: string | null;
    applyEmail: string | null;
    reason: string | null;
    aiReason: string | null;
    contentQuality: string | null;
    qualityScore: number | null;
    slug: string | null;
    excerpt: string | null;
    postUrl: string | null;
    author: string | null;
  };

  let createdRows: Row[] = [];
  let skippedRows: Row[] = [];

  if (status !== 'skipped') {
    const opps = await prisma.opportunity.findMany({
      where: {
        createdAt: { gte: since },
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                { applyEmail: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: fetchSize,
      select: {
        id: true,
        createdAt: true,
        title: true,
        applyEmail: true,
        contentQuality: true,
        qualityScore: true,
        slug: true,
      },
    });
    createdRows = opps.map((o) => ({
      id: o.id,
      createdAt: o.createdAt.toISOString(),
      status: 'created' as const,
      title: o.title,
      applyEmail: o.applyEmail,
      reason: 'created',
      aiReason: null,
      contentQuality: o.contentQuality,
      qualityScore: o.qualityScore,
      slug: o.slug,
      excerpt: null,
      postUrl: null,
      author: null,
    }));
  }

  if (status !== 'created') {
    const reasonClause = reason !== 'all' ? ` AND details->>'reason' = '${reason.replace(/'/g, "''")}'` : '';
    const searchClause = search
      ? ` AND (lower(details->>'title') LIKE '%${search.replace(/'/g, "''")}%')`
      : '';
    const skips = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        createdAt: Date;
        reason: string | null;
        aiReason: string | null;
        title: string | null;
        excerpt: string | null;
        postUrl: string | null;
        author: string | null;
      }>
    >(
      `SELECT id, "createdAt",
              details->>'reason' as reason,
              details->>'aiReason' as "aiReason",
              details->>'title' as title,
              details->>'excerpt' as excerpt,
              details->>'postUrl' as "postUrl",
              details->>'author' as author
       FROM "ActivityLog"
       WHERE action='IMPORT_SKIP' AND "createdAt" >= $1${reasonClause}${searchClause}
       ORDER BY "createdAt" DESC LIMIT $2`,
      since,
      fetchSize,
    );
    skippedRows = skips.map((s) => ({
      id: s.id,
      createdAt: new Date(s.createdAt).toISOString(),
      status: 'skipped' as const,
      title: s.title,
      applyEmail: null,
      reason: s.reason,
      aiReason: s.aiReason,
      contentQuality: null,
      qualityScore: null,
      slug: null,
      excerpt: s.excerpt,
      postUrl: s.postUrl,
      author: s.author,
    }));
  }

  // Merge by createdAt desc, paginate
  const merged = [...createdRows, ...skippedRows].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const totalRows = merged.length; // approximation within fetched window
  const pageRows = merged.slice((page - 1) * limit, page * limit);

  return NextResponse.json({
    period,
    status,
    reason,
    search,
    page,
    limit,
    totalRows,
    rows: pageRows,
    summary: {
      created: createdTotal,
      skipped: skipTotal,
      total: createdTotal + skipTotal,
      skipByReason,
      aiReasonsTop: aiReasonRows.map((r) => ({ aiReason: r.aireason || '(empty)', n: r.n })),
    },
  });
}
