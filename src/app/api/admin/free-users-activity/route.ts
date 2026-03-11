import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.CRON_SECRET;
  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [segmentAverages, hotFreeUsers, decayCurve, contentBreakdown, proOtherLinks] =
      await Promise.all([
        // Query 1: FREE vs PRO averages (PRO = only events before proStartedAt)
        prisma.$queryRaw<
          Array<{
            segment: string;
            users: bigint;
            total_emails: bigint;
            total_clicks: bigint;
          }>
        >`
          SELECT
            'FREE' as segment,
            COUNT(DISTINCT ee."to") as users,
            COUNT(DISTINCT CASE WHEN ee."type" = 'SENT' THEN ee."id" END) as total_emails,
            COUNT(DISTINCT CASE WHEN ee."type" = 'CLICKED' THEN ee."id" END) as total_clicks
          FROM "EmailEvent" ee
          JOIN "User" u ON LOWER(ee."to") = LOWER(u."email")
          WHERE u."plan" = 'FREE'

          UNION ALL

          SELECT
            'PRO' as segment,
            COUNT(DISTINCT ee."to") as users,
            COUNT(DISTINCT CASE WHEN ee."type" = 'SENT' THEN ee."id" END) as total_emails,
            COUNT(DISTINCT CASE WHEN ee."type" = 'CLICKED' THEN ee."id" END) as total_clicks
          FROM "EmailEvent" ee
          JOIN "User" u ON LOWER(ee."to") = LOWER(u."email")
          WHERE u."plan" = 'PRO'
            AND u."proStartedAt" IS NOT NULL
            AND ee."timestamp" < u."proStartedAt"
        `,

        // Query 2: Top 50 hot FREE users (those who clicked)
        prisma.$queryRaw<
          Array<{
            email: string;
            registered: Date;
            emails: bigint;
            clicks: bigint;
            last_click: Date | null;
            freelance_clicks: bigint;
            job_clicks: bigint;
          }>
        >`
          SELECT
            u."email",
            u."createdAt" as registered,
            COUNT(DISTINCT CASE WHEN ee."type" = 'SENT' THEN ee."id" END) as emails,
            COUNT(DISTINCT CASE WHEN ee."type" = 'CLICKED' THEN ee."id" END) as clicks,
            MAX(CASE WHEN ee."type" = 'CLICKED' THEN ee."timestamp" END) as last_click,
            COUNT(DISTINCT CASE WHEN ee."type" = 'CLICKED' AND ee."metadata"->>'link' LIKE '%/freelance/%' THEN ee."id" END) as freelance_clicks,
            COUNT(DISTINCT CASE WHEN ee."type" = 'CLICKED' AND ee."metadata"->>'link' LIKE '%/company/%/jobs/%' THEN ee."id" END) as job_clicks
          FROM "EmailEvent" ee
          JOIN "User" u ON LOWER(ee."to") = LOWER(u."email")
          WHERE u."plan" = 'FREE'
          GROUP BY u."id", u."email", u."createdAt"
          HAVING COUNT(DISTINCT CASE WHEN ee."type" = 'CLICKED' THEN ee."id" END) > 0
          ORDER BY clicks DESC
          LIMIT 50
        `,

        // Query 3: Decay curve — for each email number (1st, 2nd, ...) how many received & how many ever clicked
        prisma.$queryRaw<
          Array<{
            email_num: bigint;
            recipients: bigint;
            clickers: bigint;
          }>
        >`
          WITH numbered_emails AS (
            SELECT
              ee."to",
              ee."id",
              ROW_NUMBER() OVER (PARTITION BY ee."to" ORDER BY ee."timestamp") as email_num
            FROM "EmailEvent" ee
            JOIN "User" u ON LOWER(ee."to") = LOWER(u."email")
            WHERE ee."type" = 'SENT'
              AND u."plan" = 'FREE'
          ),
          clicks AS (
            SELECT DISTINCT ee."to"
            FROM "EmailEvent" ee
            JOIN "User" u ON LOWER(ee."to") = LOWER(u."email")
            WHERE ee."type" = 'CLICKED'
              AND u."plan" = 'FREE'
          )
          SELECT
            ne.email_num,
            COUNT(DISTINCT ne."to") as recipients,
            COUNT(DISTINCT CASE WHEN c."to" IS NOT NULL THEN ne."to" END) as clickers
          FROM numbered_emails ne
          LEFT JOIN clicks c ON ne."to" = c."to"
          WHERE ne.email_num <= 30
          GROUP BY ne.email_num
          ORDER BY ne.email_num
        `,

        // Query 4: Content breakdown — what FREE vs PRO (before purchase) click on
        prisma.$queryRaw<
          Array<{
            segment: string;
            freelance: bigint;
            jobs: bigint;
            other: bigint;
          }>
        >`
          SELECT
            CASE WHEN u."plan" = 'PRO' THEN 'PRO' ELSE 'FREE' END as segment,
            COUNT(DISTINCT CASE WHEN ee."metadata"->>'link' LIKE '%/freelance/%' THEN ee."id" END) as freelance,
            COUNT(DISTINCT CASE WHEN ee."metadata"->>'link' LIKE '%/company/%/jobs/%' THEN ee."id" END) as jobs,
            COUNT(DISTINCT CASE WHEN ee."metadata"->>'link' NOT LIKE '%/freelance/%'
              AND ee."metadata"->>'link' NOT LIKE '%/company/%/jobs/%'
              AND ee."metadata"->>'link' IS NOT NULL THEN ee."id" END) as other
          FROM "EmailEvent" ee
          JOIN "User" u ON LOWER(ee."to") = LOWER(u."email")
          WHERE ee."type" = 'CLICKED'
            AND (u."plan" = 'FREE' OR (u."plan" = 'PRO' AND u."proStartedAt" IS NOT NULL AND ee."timestamp" < u."proStartedAt"))
          GROUP BY CASE WHEN u."plan" = 'PRO' THEN 'PRO' ELSE 'FREE' END
        `,

        // Query 5: PRO "other" links detail — what exactly did PRO users click before buying?
        prisma.$queryRaw<
          Array<{
            link: string;
            clicks: bigint;
            users: bigint;
          }>
        >`
          SELECT
            ee."metadata"->>'link' as link,
            COUNT(*) as clicks,
            COUNT(DISTINCT ee."to") as users
          FROM "EmailEvent" ee
          JOIN "User" u ON LOWER(ee."to") = LOWER(u."email")
          WHERE ee."type" = 'CLICKED'
            AND u."plan" = 'PRO'
            AND u."proStartedAt" IS NOT NULL
            AND ee."timestamp" < u."proStartedAt"
            AND ee."metadata"->>'link' IS NOT NULL
          GROUP BY ee."metadata"->>'link'
          ORDER BY clicks DESC
          LIMIT 50
        `,
      ]);

    // Serialize bigints and mask emails
    const serializeSegment = (
      row: { segment: string; users: bigint; total_emails: bigint; total_clicks: bigint }
    ) => {
      const users = Number(row.users);
      const totalEmails = Number(row.total_emails);
      const totalClicks = Number(row.total_clicks);
      return {
        segment: row.segment,
        users,
        totalEmails,
        totalClicks,
        avgEmails: users > 0 ? Math.round((totalEmails / users) * 10) / 10 : 0,
        avgClicks: users > 0 ? Math.round((totalClicks / users) * 10) / 10 : 0,
      };
    };

    const maskEmail = (email: string) => {
      const [local, domain] = email.split('@');
      if (!domain) return '***';
      const visible = local.slice(0, 2);
      return `${visible}***@${domain}`;
    };

    const now = new Date();

    return NextResponse.json({
      segmentAverages: segmentAverages.map(serializeSegment),

      hotFreeUsers: hotFreeUsers.map((u) => ({
        email: maskEmail(u.email),
        registered: u.registered,
        emails: Number(u.emails),
        clicks: Number(u.clicks),
        lastClick: u.last_click,
        daysOnPlatform: Math.floor(
          (now.getTime() - new Date(u.registered).getTime()) / (1000 * 60 * 60 * 24)
        ),
        freelanceClicks: Number(u.freelance_clicks),
        jobClicks: Number(u.job_clicks),
      })),

      decayCurve: decayCurve.map((d) => ({
        emailNum: Number(d.email_num),
        recipients: Number(d.recipients),
        clickers: Number(d.clickers),
        clickerPct:
          Number(d.recipients) > 0
            ? Math.round((Number(d.clickers) / Number(d.recipients)) * 1000) / 10
            : 0,
      })),

      proOtherLinks: proOtherLinks.map((l) => ({
        link: l.link,
        clicks: Number(l.clicks),
        users: Number(l.users),
      })),

      contentBreakdown: contentBreakdown.map((c) => {
        const total = Number(c.freelance) + Number(c.jobs) + Number(c.other);
        return {
          segment: c.segment,
          freelance: Number(c.freelance),
          jobs: Number(c.jobs),
          other: Number(c.other),
          total,
          freelancePct: total > 0 ? Math.round((Number(c.freelance) / total) * 1000) / 10 : 0,
          jobsPct: total > 0 ? Math.round((Number(c.jobs) / total) * 1000) / 10 : 0,
          otherPct: total > 0 ? Math.round((Number(c.other) / total) * 1000) / 10 : 0,
        };
      }),
    });
  } catch (error) {
    console.error('Free users activity error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch free users activity' },
      { status: 500 }
    );
  }
}
